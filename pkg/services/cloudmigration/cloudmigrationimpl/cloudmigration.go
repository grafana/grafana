package cloudmigrationimpl

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/api"
	"github.com/grafana/grafana/pkg/services/cloudmigration/gmsclient"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Service Define the cloudmigration.Service Implementation.
type Service struct {
	store store

	log *log.ConcreteLogger
	cfg *setting.Cfg

	buildSnapshotMutex sync.Mutex
	buildSnapshotError bool

	features  featuremgmt.FeatureToggles
	gmsClient gmsclient.Client

	dsService        datasources.DataSourceService
	gcomService      gcom.Service
	dashboardService dashboards.DashboardService
	folderService    folder.Service
	secretsService   secrets.Service

	api     *api.CloudMigrationAPI
	tracer  tracing.Tracer
	metrics *Metrics
}

var LogPrefix = "cloudmigration.service"

const (
	// nolint:gosec
	cloudMigrationAccessPolicyNamePrefix = "grafana-cloud-migrations"
	//nolint:gosec
	cloudMigrationTokenNamePrefix = "grafana-cloud-migrations"
)

var _ cloudmigration.Service = (*Service)(nil)

// ProvideService Factory for method used by wire to inject dependencies.
// builds the service, and api, and configures routes
func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db db.DB,
	dsService datasources.DataSourceService,
	secretsService secrets.Service,
	routeRegister routing.RouteRegister,
	prom prometheus.Registerer,
	tracer tracing.Tracer,
	dashboardService dashboards.DashboardService,
	folderService folder.Service,
) (cloudmigration.Service, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrations) {
		return &NoopServiceImpl{}, nil
	}

	s := &Service{
		store:            &sqlStore{db: db, secretsService: secretsService},
		log:              log.New(LogPrefix),
		cfg:              cfg,
		features:         features,
		dsService:        dsService,
		tracer:           tracer,
		metrics:          newMetrics(),
		secretsService:   secretsService,
		dashboardService: dashboardService,
		folderService:    folderService,
	}
	s.api = api.RegisterApi(routeRegister, s, tracer)

	if !cfg.CloudMigration.IsDeveloperMode {
		// get GMS path from the config
		domain, err := s.parseCloudMigrationConfig()
		if err != nil {
			return nil, fmt.Errorf("config parse error: %w", err)
		}
		s.gmsClient = gmsclient.NewGMSClient(domain)

		s.gcomService = gcom.New(gcom.Config{ApiURL: cfg.GrafanaComAPIURL, Token: cfg.CloudMigration.GcomAPIToken})
	} else {
		s.gmsClient = gmsclient.NewInMemoryClient()
		s.gcomService = &gcomStub{policies: map[string]gcom.AccessPolicy{}, token: nil}
		s.cfg.StackID = "12345"
	}

	if err := prom.Register(s.metrics); err != nil {
		var alreadyRegisterErr prometheus.AlreadyRegisteredError
		if errors.As(err, &alreadyRegisterErr) {
			s.log.Warn("cloud migration metrics already registered")
		} else {
			return s, fmt.Errorf("registering cloud migration metrics: %w", err)
		}
	}

	return s, nil
}

func (s *Service) GetToken(ctx context.Context) (gcom.TokenView, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetToken")
	defer span.End()
	logger := s.log.FromContext(ctx)
	requestID := tracing.TraceIDFromContext(ctx, false)

	timeoutCtx, cancel := context.WithTimeout(ctx, s.cfg.CloudMigration.FetchInstanceTimeout)
	defer cancel()
	instance, err := s.gcomService.GetInstanceByID(timeoutCtx, requestID, s.cfg.StackID)
	if err != nil {
		return gcom.TokenView{}, fmt.Errorf("fetching instance by id: id=%s %w", s.cfg.StackID, err)
	}

	logger.Info("instance found", "slug", instance.Slug)

	accessPolicyName := fmt.Sprintf("%s-%s", cloudMigrationAccessPolicyNamePrefix, s.cfg.StackID)
	accessTokenName := fmt.Sprintf("%s-%s", cloudMigrationTokenNamePrefix, s.cfg.StackID)

	timeoutCtx, cancel = context.WithTimeout(ctx, s.cfg.CloudMigration.ListTokensTimeout)
	defer cancel()
	tokens, err := s.gcomService.ListTokens(timeoutCtx, gcom.ListTokenParams{
		RequestID:        requestID,
		Region:           instance.RegionSlug,
		AccessPolicyName: accessPolicyName,
		TokenName:        accessTokenName})
	if err != nil {
		return gcom.TokenView{}, fmt.Errorf("listing tokens: %w", err)
	}
	logger.Info("found access tokens", "num_tokens", len(tokens))

	for _, token := range tokens {
		if token.Name == accessTokenName {
			logger.Info("found existing cloud migration token", "tokenID", token.ID, "accessPolicyID", token.AccessPolicyID)
			return token, nil
		}
	}

	logger.Info("cloud migration token not found")
	return gcom.TokenView{}, cloudmigration.ErrTokenNotFound
}

func (s *Service) CreateToken(ctx context.Context) (cloudmigration.CreateAccessTokenResponse, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.CreateToken")
	defer span.End()
	logger := s.log.FromContext(ctx)
	requestID := tracing.TraceIDFromContext(ctx, false)

	timeoutCtx, cancel := context.WithTimeout(ctx, s.cfg.CloudMigration.FetchInstanceTimeout)
	defer cancel()
	instance, err := s.gcomService.GetInstanceByID(timeoutCtx, requestID, s.cfg.StackID)
	if err != nil {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("fetching instance by id: id=%s %w", s.cfg.StackID, err)
	}

	// Add the stack id to the access policy name to ensure access policies in a org have unique names.
	accessPolicyName := fmt.Sprintf("%s-%s", cloudMigrationAccessPolicyNamePrefix, s.cfg.StackID)
	accessPolicyDisplayName := fmt.Sprintf("%s-%s", s.cfg.Slug, cloudMigrationAccessPolicyNamePrefix)

	timeoutCtx, cancel = context.WithTimeout(ctx, s.cfg.CloudMigration.FetchAccessPolicyTimeout)
	defer cancel()
	existingAccessPolicy, err := s.findAccessPolicyByName(timeoutCtx, instance.RegionSlug, accessPolicyName)
	if err != nil {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("fetching access policy by name: name=%s %w", accessPolicyName, err)
	}

	if existingAccessPolicy != nil {
		timeoutCtx, cancel := context.WithTimeout(ctx, s.cfg.CloudMigration.DeleteAccessPolicyTimeout)
		defer cancel()
		if _, err := s.gcomService.DeleteAccessPolicy(timeoutCtx, gcom.DeleteAccessPolicyParams{
			RequestID:      requestID,
			AccessPolicyID: existingAccessPolicy.ID,
			Region:         instance.RegionSlug,
		}); err != nil {
			return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("deleting access policy: id=%s region=%s %w", existingAccessPolicy.ID, instance.RegionSlug, err)
		}
		logger.Info("deleted access policy", existingAccessPolicy.ID, "name", existingAccessPolicy.Name)
	}

	timeoutCtx, cancel = context.WithTimeout(ctx, s.cfg.CloudMigration.CreateAccessPolicyTimeout)
	defer cancel()
	accessPolicy, err := s.gcomService.CreateAccessPolicy(timeoutCtx,
		gcom.CreateAccessPolicyParams{
			RequestID: requestID,
			Region:    instance.RegionSlug,
		},
		gcom.CreateAccessPolicyPayload{
			Name:        accessPolicyName,
			DisplayName: accessPolicyDisplayName,
			Realms:      []gcom.Realm{{Type: "stack", Identifier: s.cfg.StackID, LabelPolicies: []gcom.LabelPolicy{}}},
			Scopes:      []string{"cloud-migrations:read", "cloud-migrations:write"},
		})
	if err != nil {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("creating access policy: %w", err)
	}
	logger.Info("created access policy", "id", accessPolicy.ID, "name", accessPolicy.Name)

	// Add the stack id to the token name to ensure tokens in a org have unique names.
	accessTokenName := fmt.Sprintf("%s-%s", cloudMigrationTokenNamePrefix, s.cfg.StackID)
	accessTokenDisplayName := fmt.Sprintf("%s-%s", s.cfg.Slug, cloudMigrationTokenNamePrefix)
	timeoutCtx, cancel = context.WithTimeout(ctx, s.cfg.CloudMigration.CreateTokenTimeout)
	defer cancel()

	token, err := s.gcomService.CreateToken(timeoutCtx,
		gcom.CreateTokenParams{RequestID: requestID, Region: instance.RegionSlug},
		gcom.CreateTokenPayload{
			AccessPolicyID: accessPolicy.ID,
			Name:           accessTokenName,
			DisplayName:    accessTokenDisplayName,
			ExpiresAt:      time.Now().Add(s.cfg.CloudMigration.TokenExpiresAfter),
		})
	if err != nil {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("creating access token: %w", err)
	}
	logger.Info("created access token", "id", token.ID, "name", token.Name)
	s.metrics.accessTokenCreated.With(prometheus.Labels{"slug": s.cfg.Slug}).Inc()

	bytes, err := json.Marshal(cloudmigration.Base64EncodedTokenPayload{
		Token: token.Token,
		Instance: cloudmigration.Base64HGInstance{
			StackID:     instance.ID,
			RegionSlug:  instance.RegionSlug,
			ClusterSlug: instance.ClusterSlug, // This should be used for routing to GMS
			Slug:        instance.Slug,
		},
	})
	if err != nil {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("encoding token: %w", err)
	}

	return cloudmigration.CreateAccessTokenResponse{Token: base64.StdEncoding.EncodeToString(bytes)}, nil
}

func (s *Service) findAccessPolicyByName(ctx context.Context, regionSlug, accessPolicyName string) (*gcom.AccessPolicy, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.findAccessPolicyByName")
	defer span.End()

	accessPolicies, err := s.gcomService.ListAccessPolicies(ctx, gcom.ListAccessPoliciesParams{
		RequestID: tracing.TraceIDFromContext(ctx, false),
		Region:    regionSlug,
		Name:      accessPolicyName,
	})
	if err != nil {
		return nil, fmt.Errorf("listing access policies: name=%s region=%s :%w", accessPolicyName, regionSlug, err)
	}

	for _, accessPolicy := range accessPolicies {
		if accessPolicy.Name == accessPolicyName {
			return &accessPolicy, nil
		}
	}

	return nil, nil
}

func (s *Service) ValidateToken(ctx context.Context, cm cloudmigration.CloudMigrationSession) error {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.ValidateToken")
	defer span.End()

	if err := s.gmsClient.ValidateKey(ctx, cm); err != nil {
		return fmt.Errorf("validating key: %w", err)
	}

	return nil
}

func (s *Service) DeleteToken(ctx context.Context, tokenID string) error {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.DeleteToken", trace.WithAttributes(attribute.String("tokenID", tokenID)))
	defer span.End()
	logger := s.log.FromContext(ctx)
	requestID := tracing.TraceIDFromContext(ctx, false)

	timeoutCtx, cancel := context.WithTimeout(ctx, s.cfg.CloudMigration.FetchInstanceTimeout)
	defer cancel()
	instance, err := s.gcomService.GetInstanceByID(timeoutCtx, requestID, s.cfg.StackID)
	if err != nil {
		return fmt.Errorf("fetching instance by id: id=%s %w", s.cfg.StackID, err)
	}
	logger.Info("found instance", "instanceID", instance.ID)

	timeoutCtx, cancel = context.WithTimeout(ctx, s.cfg.CloudMigration.DeleteTokenTimeout)
	defer cancel()
	if err := s.gcomService.DeleteToken(timeoutCtx, gcom.DeleteTokenParams{
		RequestID: tracing.TraceIDFromContext(ctx, false),
		Region:    instance.RegionSlug,
		TokenID:   tokenID,
	}); err != nil && !errors.Is(err, gcom.ErrTokenNotFound) {
		return fmt.Errorf("deleting cloud migration token: tokenID=%s %w", tokenID, err)
	}
	logger.Info("deleted cloud migration token", "tokenID", tokenID)
	s.metrics.accessTokenDeleted.With(prometheus.Labels{"slug": s.cfg.Slug}).Inc()

	return nil
}

func (s *Service) GetSession(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetMigration")
	defer span.End()
	migration, err := s.store.GetMigrationSessionByUID(ctx, uid)
	if err != nil {
		return nil, err
	}

	return migration, nil
}

func (s *Service) GetSessionList(ctx context.Context) (*cloudmigration.CloudMigrationSessionListResponse, error) {
	values, err := s.store.GetAllCloudMigrationSessions(ctx)
	if err != nil {
		return nil, err
	}

	migrations := make([]cloudmigration.CloudMigrationSessionResponse, 0)
	for _, v := range values {
		migrations = append(migrations, cloudmigration.CloudMigrationSessionResponse{
			UID:     v.UID,
			Slug:    v.Slug,
			Created: v.Created,
			Updated: v.Updated,
		})
	}
	return &cloudmigration.CloudMigrationSessionListResponse{Sessions: migrations}, nil
}

func (s *Service) CreateSession(ctx context.Context, cmd cloudmigration.CloudMigrationSessionRequest) (*cloudmigration.CloudMigrationSessionResponse, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.createMigration")
	defer span.End()

	base64Token := cmd.AuthToken
	b, err := base64.StdEncoding.DecodeString(base64Token)
	if err != nil {
		return nil, fmt.Errorf("token could not be decoded")
	}
	var token cloudmigration.Base64EncodedTokenPayload
	if err := json.Unmarshal(b, &token); err != nil {
		return nil, fmt.Errorf("invalid token") // don't want to leak info here
	}

	migration := token.ToMigration()
	// validate token against GMS before saving
	if err := s.ValidateToken(ctx, migration); err != nil {
		return nil, fmt.Errorf("token validation: %w", err)
	}

	cm, err := s.store.CreateMigrationSession(ctx, migration)
	if err != nil {
		return nil, fmt.Errorf("error creating migration: %w", err)
	}

	return &cloudmigration.CloudMigrationSessionResponse{
		UID:     cm.UID,
		Slug:    token.Instance.Slug,
		Created: cm.Created,
		Updated: cm.Updated,
	}, nil
}

func (s *Service) RunMigration(ctx context.Context, uid string) (*cloudmigration.MigrateDataResponse, error) {
	// Get migration to read the auth token
	migration, err := s.GetSession(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("migration get error: %w", err)
	}

	// Get migration data JSON
	request, err := s.getMigrationDataJSON(ctx)
	if err != nil {
		s.log.Error("error getting the json request body for migration run", "err", err.Error())
		return nil, fmt.Errorf("migration data get error: %w", err)
	}

	// Call the gms service
	resp, err := s.gmsClient.MigrateData(ctx, *migration, *request)
	if err != nil {
		s.log.Error("error migrating data: %w", err)
		return nil, fmt.Errorf("migrate data error: %w", err)
	}

	// save the result of the migration
	runUID, err := s.createMigrationRun(ctx, cloudmigration.CloudMigrationSnapshot{
		SessionUID: migration.UID,
		Resources:  resp.Items,
	})
	if err != nil {
		response.Error(http.StatusInternalServerError, "migration run save error", err)
	}

	resp.RunUID = runUID

	return resp, nil
}

func (s *Service) createMigrationRun(ctx context.Context, cmr cloudmigration.CloudMigrationSnapshot) (string, error) {
	uid, err := s.store.CreateMigrationRun(ctx, cmr)
	if err != nil {
		s.log.Error("Failed to save migration run", "err", err)
		return "", err
	}
	return uid, nil
}

func (s *Service) GetMigrationStatus(ctx context.Context, runUID string) (*cloudmigration.CloudMigrationSnapshot, error) {
	cmr, err := s.store.GetMigrationStatus(ctx, runUID)
	if err != nil {
		return nil, fmt.Errorf("retrieving migration status from db: %w", err)
	}
	return cmr, nil
}

func (s *Service) GetMigrationRunList(ctx context.Context, migUID string) (*cloudmigration.CloudMigrationRunList, error) {
	runs, err := s.store.GetMigrationStatusList(ctx, migUID)
	if err != nil {
		return nil, fmt.Errorf("retrieving migration statuses from db: %w", err)
	}

	runList := &cloudmigration.CloudMigrationRunList{Runs: []cloudmigration.MigrateDataResponseList{}}
	for _, s := range runs {
		runList.Runs = append(runList.Runs, cloudmigration.MigrateDataResponseList{
			RunUID: s.UID,
		})
	}

	return runList, nil
}

func (s *Service) DeleteSession(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error) {
	c, err := s.store.DeleteMigrationSessionByUID(ctx, uid)
	if err != nil {
		return c, fmt.Errorf("deleting migration from db: %w", err)
	}
	return c, nil
}

func (s *Service) CreateSnapshot(ctx context.Context, sessionUid string) (*cloudmigration.CloudMigrationSnapshot, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.CreateSnapshot")
	defer span.End()

	// fetch session for the gms auth token
	session, err := s.store.GetMigrationSessionByUID(ctx, sessionUid)
	if err != nil {
		return nil, fmt.Errorf("fetching migration session for uid %s: %w", sessionUid, err)
	}

	// query gms to establish new snapshot
	initResp, err := s.gmsClient.InitializeSnapshot(ctx, *session)
	if err != nil {
		return nil, fmt.Errorf("initializing snapshot with GMS for session %s: %w", sessionUid, err)
	}

	// create new directory for snapshot writing
	snapshotUid := util.GenerateShortUID()
	dir := filepath.Join("cloudmigration.snapshots", fmt.Sprintf("snapshot-%s-%s", snapshotUid, initResp.GMSSnapshotUID))
	err = os.MkdirAll(dir, 0750)
	if err != nil {
		return nil, fmt.Errorf("creating snapshot directory: %w", err)
	}

	// save snapshot to the db
	snapshot := cloudmigration.CloudMigrationSnapshot{
		UID:            snapshotUid,
		SessionUID:     sessionUid,
		Status:         cloudmigration.SnapshotStatusInitializing,
		EncryptionKey:  initResp.EncryptionKey,
		UploadURL:      initResp.UploadURL,
		GMSSnapshotUID: initResp.GMSSnapshotUID,
		LocalDir:       dir,
	}

	uid, err := s.store.CreateSnapshot(ctx, snapshot)
	if err != nil {
		return nil, fmt.Errorf("saving snapshot: %w", err)
	}
	snapshot.UID = uid

	// start building the snapshot asynchronously while we return a success response to the client
	go s.buildSnapshot(context.Background(), snapshot)

	return &snapshot, nil
}

// GetSnapshot returns the on-prem version of a snapshot, supplemented with processing status from GMS
func (s *Service) GetSnapshot(ctx context.Context, query cloudmigration.GetSnapshotsQuery) (*cloudmigration.CloudMigrationSnapshot, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetSnapshot")
	defer span.End()

	sessionUid, snapshotUid := query.SessionUID, query.SnapshotUID
	snapshot, err := s.store.GetSnapshotByUID(ctx, snapshotUid, query.ResultOffset, query.ResultLimit)
	if err != nil {
		return nil, fmt.Errorf("fetching snapshot for uid %s: %w", snapshotUid, err)
	}

	session, err := s.store.GetMigrationSessionByUID(ctx, sessionUid)
	if err != nil {
		return nil, fmt.Errorf("fetching session for uid %s: %w", sessionUid, err)
	}

	if snapshot.ShouldQueryGMS() {
		// ask GMS for status if it's in the cloud
		snapshotMeta, err := s.gmsClient.GetSnapshotStatus(ctx, *session, *snapshot)
		if err != nil {
			return nil, fmt.Errorf("error fetching snapshot status from GMS: sessionUid: %s, snapshotUid: %s", sessionUid, snapshotUid)
		}

		if snapshotMeta.Status == cloudmigration.SnapshotStatusFinished {
			// we need to update the snapshot in our db before reporting anything finished to the client
			if err := s.store.UpdateSnapshot(ctx, cloudmigration.UpdateSnapshotCmd{
				UID:       snapshot.UID,
				Status:    cloudmigration.SnapshotStatusFinished,
				Resources: snapshot.Resources,
			}); err != nil {
				return nil, fmt.Errorf("error updating snapshot status: %w", err)
			}
		}
	}

	return snapshot, nil
}

func (s *Service) GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetSnapshotList")
	defer span.End()

	snapshotList, err := s.store.GetSnapshotList(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("fetching snapshots for session uid %s: %w", query.SessionUID, err)
	}
	return snapshotList, nil
}

func (s *Service) UploadSnapshot(ctx context.Context, sessionUid string, snapshotUid string) error {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.UploadSnapshot")
	defer span.End()

	snapshot, err := s.GetSnapshot(ctx, cloudmigration.GetSnapshotsQuery{
		SnapshotUID: snapshotUid,
		SessionUID:  sessionUid,
	})
	if err != nil {
		return fmt.Errorf("fetching snapshot with uid %s: %w", snapshotUid, err)
	}

	s.log.Info("Uploading snapshot with GMS ID %s in local directory %s to url %s", snapshot.GMSSnapshotUID, snapshot.LocalDir, snapshot.UploadURL)
	s.log.Debug("UploadSnapshot not yet implemented, faking it")

	// start uploading the snapshot asynchronously while we return a success response to the client
	go s.uploadSnapshot(context.Background(), *snapshot)

	return nil
}

func (s *Service) CancelSnapshot(ctx context.Context, sessionUid string, snapshotUid string) error {
	panic("not implemented")
}

func (s *Service) parseCloudMigrationConfig() (string, error) {
	if s.cfg == nil {
		return "", fmt.Errorf("cfg cannot be nil")
	}
	section := s.cfg.Raw.Section("cloud_migration")
	domain := section.Key("domain").MustString("")
	if domain == "" {
		return "", fmt.Errorf("cloudmigration domain not set")
	}
	return domain, nil
}
