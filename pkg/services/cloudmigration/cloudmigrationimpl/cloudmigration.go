package cloudmigrationimpl

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authapi"
	"github.com/grafana/grafana/pkg/services/authapi/fake"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/api"
	"github.com/grafana/grafana/pkg/services/cloudmigration/gmsclient"
	"github.com/grafana/grafana/pkg/services/cloudmigration/objectstorage"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretskv "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// Service Define the cloudmigration.Service Implementation.
type Service struct {
	store store

	log *log.ConcreteLogger
	cfg *setting.Cfg

	buildSnapshotMutex sync.Mutex

	cancelMutex sync.Mutex
	cancelFunc  context.CancelFunc

	isSyncSnapshotStatusFromGMSRunning int32

	features      featuremgmt.FeatureToggles
	gmsClient     gmsclient.Client
	objectStorage objectstorage.ObjectStorage

	dsService              datasources.DataSourceService
	gcomService            gcom.Service
	authApiService         authapi.Service
	dashboardService       dashboards.DashboardService
	folderService          folder.Service
	pluginStore            pluginstore.Store
	accessControl          accesscontrol.AccessControl
	pluginSettingsService  pluginsettings.Service
	secretsService         secrets.Service
	kvStore                *kvstore.NamespacedKVStore
	libraryElementsService libraryelements.Service
	ngAlert                *ngalert.AlertNG

	api     *api.CloudMigrationAPI
	tracer  tracing.Tracer
	metrics *Metrics

	grafanaVersion string
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
	httpClientProvider *httpclient.Provider,
	features featuremgmt.FeatureToggles,
	db db.DB,
	dsService datasources.DataSourceService,
	secretsStore secretskv.SecretsKVStore,
	secretsService secrets.Service,
	routeRegister routing.RouteRegister,
	prom prometheus.Registerer,
	tracer tracing.Tracer,
	dashboardService dashboards.DashboardService,
	folderService folder.Service,
	pluginStore pluginstore.Store,
	pluginSettingsService pluginsettings.Service,
	accessControl accesscontrol.AccessControl,
	acService accesscontrol.Service,
	kvStore kvstore.KVStore,
	libraryElementsService libraryelements.Service,
	ngAlert *ngalert.AlertNG,
) (cloudmigration.Service, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrations) {
		return &NoopServiceImpl{}, nil
	}

	if err := cloudmigration.RegisterAccessControlRoles(acService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	s := &Service{
		store:                  &sqlStore{db: db, secretsStore: secretsStore, secretsService: secretsService},
		log:                    log.New(LogPrefix),
		cfg:                    cfg,
		features:               features,
		dsService:              dsService,
		tracer:                 tracer,
		metrics:                newMetrics(),
		secretsService:         secretsService,
		dashboardService:       dashboardService,
		folderService:          folderService,
		pluginStore:            pluginStore,
		pluginSettingsService:  pluginSettingsService,
		accessControl:          accessControl,
		kvStore:                kvstore.WithNamespace(kvStore, 0, "cloudmigration"),
		libraryElementsService: libraryElementsService,
		ngAlert:                ngAlert,
	}
	s.api = api.RegisterApi(routeRegister, s, tracer, accessControl, cloudmigration.ResourceDependency)

	httpClientS3, err := httpClientProvider.New()
	if err != nil {
		return nil, fmt.Errorf("creating http client for S3: %w", err)
	}
	s.objectStorage = objectstorage.NewS3(httpClientS3, tracer)

	if !cfg.CloudMigration.IsDeveloperMode {
		httpClientGMS, err := httpClientProvider.New()
		if err != nil {
			return nil, fmt.Errorf("creating http client for GMS: %w", err)
		}

		c, err := gmsclient.NewGMSClient(cfg, httpClientGMS)
		if err != nil {
			return nil, fmt.Errorf("initializing GMS client: %w", err)
		}
		s.gmsClient = c

		httpClientGcom, err := httpClientProvider.New()
		if err != nil {
			return nil, fmt.Errorf("creating http client for GCOM: %w", err)
		}
		s.gcomService = gcom.New(gcom.Config{ApiURL: cfg.GrafanaComAPIURL, Token: cfg.CloudMigration.GcomAPIToken}, httpClientGcom)

		httpClientAuthApi, err := httpClientProvider.New()
		if err != nil {
			return nil, fmt.Errorf("creating http client for AuthApi: %w", err)
		}
		// the api token is the same as for gcom
		s.authApiService = authapi.New(authapi.Config{ApiURL: cfg.CloudMigration.AuthAPIUrl, Token: cfg.CloudMigration.GcomAPIToken}, httpClientAuthApi)
	} else {
		s.gmsClient = gmsclient.NewInMemoryClient()
		s.gcomService = &gcomStub{}
		s.authApiService = &fake.AuthapiStub{Policies: map[string]authapi.AccessPolicy{}, Token: nil}
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

	s.grafanaVersion = cfg.BuildVersion

	return s, nil
}

func (s *Service) GetToken(ctx context.Context) (authapi.TokenView, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetToken")
	defer span.End()
	logger := s.log.FromContext(ctx)
	requestID := tracing.TraceIDFromContext(ctx, false)

	timeoutCtx, cancel := context.WithTimeout(ctx, s.cfg.CloudMigration.FetchInstanceTimeout)
	defer cancel()
	instance, err := s.gcomService.GetInstanceByID(timeoutCtx, requestID, s.cfg.StackID)
	if err != nil {
		return authapi.TokenView{}, fmt.Errorf("fetching instance by id: id=%s %w", s.cfg.StackID, err)
	}

	logger.Info("instance found", "slug", instance.Slug)

	accessPolicyName := fmt.Sprintf("%s-%s", cloudMigrationAccessPolicyNamePrefix, s.cfg.StackID)
	accessTokenName := fmt.Sprintf("%s-%s", cloudMigrationTokenNamePrefix, s.cfg.StackID)

	timeoutCtx, cancel = context.WithTimeout(ctx, s.cfg.CloudMigration.ListTokensTimeout)
	defer cancel()
	tokens, err := s.authApiService.ListTokens(timeoutCtx, authapi.ListTokenParams{
		RequestID:        requestID,
		AccessPolicyName: accessPolicyName,
		TokenName:        accessTokenName,
		Region:           instance.RegionSlug,
	})
	if err != nil {
		return authapi.TokenView{}, fmt.Errorf("listing tokens: %w", err)
	}
	logger.Info("found access tokens", "num_tokens", len(tokens))

	for _, token := range tokens {
		if token.Name == accessTokenName {
			logger.Info("found existing cloud migration token", "tokenID", token.ID, "accessPolicyID", token.AccessPolicyID)
			return token, nil
		}
	}

	logger.Info("cloud migration token not found")
	return authapi.TokenView{}, fmt.Errorf("fetching cloud migration token: instance=%+v accessPolicyName=%s accessTokenName=%s %w",
		instance, accessPolicyName, accessTokenName, cloudmigration.ErrTokenNotFound)
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
	existingAccessPolicy, err := s.findAccessPolicyByName(timeoutCtx, accessPolicyName, instance.RegionSlug)
	if err != nil {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("fetching access policy by name: name=%s %w", accessPolicyName, err)
	}

	if existingAccessPolicy != nil {
		timeoutCtx, cancel := context.WithTimeout(ctx, s.cfg.CloudMigration.DeleteAccessPolicyTimeout)
		defer cancel()
		if _, err := s.authApiService.DeleteAccessPolicy(timeoutCtx, authapi.DeleteAccessPolicyParams{
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
	accessPolicy, err := s.authApiService.CreateAccessPolicy(timeoutCtx,
		authapi.CreateAccessPolicyParams{
			RequestID: requestID,
			Region:    instance.RegionSlug,
		},
		authapi.CreateAccessPolicyPayload{
			Name:        accessPolicyName,
			DisplayName: accessPolicyDisplayName,
			Realms:      []authapi.Realm{{Type: "stack", Identifier: s.cfg.StackID, LabelPolicies: []authapi.LabelPolicy{}}},
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

	token, err := s.authApiService.CreateToken(timeoutCtx,
		authapi.CreateTokenParams{
			RequestID: requestID,
			Region:    instance.RegionSlug,
		},
		authapi.CreateTokenPayload{
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

func (s *Service) findAccessPolicyByName(ctx context.Context, accessPolicyName string, region string) (*authapi.AccessPolicy, error) {
	accessPolicies, err := s.authApiService.ListAccessPolicies(ctx, authapi.ListAccessPoliciesParams{
		RequestID: tracing.TraceIDFromContext(ctx, false),
		Name:      accessPolicyName,
		Region:    region,
	})
	if err != nil {
		return nil, fmt.Errorf("listing access policies: name=%s :%w", accessPolicyName, err)
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
		return err
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
	if err := s.authApiService.DeleteToken(timeoutCtx, authapi.DeleteTokenParams{
		RequestID: tracing.TraceIDFromContext(ctx, false),
		TokenID:   tokenID,
		Region:    instance.RegionSlug,
	}); err != nil && !errors.Is(err, gcom.ErrTokenNotFound) {
		return fmt.Errorf("deleting cloud migration token: tokenID=%s %w", tokenID, err)
	}
	logger.Info("deleted cloud migration token", "tokenID", tokenID)
	s.metrics.accessTokenDeleted.With(prometheus.Labels{"slug": s.cfg.Slug}).Inc()

	return nil
}

func (s *Service) GetSession(ctx context.Context, orgID int64, uid string) (*cloudmigration.CloudMigrationSession, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetSession")
	defer span.End()
	migration, err := s.store.GetMigrationSessionByUID(ctx, orgID, uid)
	if err != nil {
		return nil, err
	}

	return migration, nil
}

func (s *Service) GetSessionList(ctx context.Context, orgID int64) (*cloudmigration.CloudMigrationSessionListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetSessionList")
	defer span.End()

	values, err := s.store.GetCloudMigrationSessionList(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("retrieving session list from store: %w", err)
	}

	migrations := make([]cloudmigration.CloudMigrationSessionResponse, 0, len(values))
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

func (s *Service) CreateSession(ctx context.Context, signedInUser *user.SignedInUser, cmd cloudmigration.CloudMigrationSessionRequest) (*cloudmigration.CloudMigrationSessionResponse, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.CreateSession")
	defer span.End()

	base64Token := cmd.AuthToken
	b, err := base64.StdEncoding.DecodeString(base64Token)
	if err != nil {
		return nil, cloudmigration.ErrTokenInvalid.Errorf("token could not be decoded")
	}
	var token cloudmigration.Base64EncodedTokenPayload
	if err := json.Unmarshal(b, &token); err != nil {
		return nil, cloudmigration.ErrTokenInvalid.Errorf("token could not be decoded") // don't want to leak info here
	}

	migration := token.ToMigration(cmd.OrgID)
	// validate token against GMS before saving
	if err := s.ValidateToken(ctx, migration); err != nil {
		return nil, err
	}

	cm, err := s.store.CreateMigrationSession(ctx, migration)
	if err != nil {
		return nil, cloudmigration.ErrSessionCreationFailure.Errorf("error creating migration")
	}

	s.report(ctx, &migration, gmsclient.EventConnect, 0, nil, signedInUser.UserUID)

	return &cloudmigration.CloudMigrationSessionResponse{
		UID:     cm.UID,
		Slug:    token.Instance.Slug,
		Created: cm.Created,
		Updated: cm.Updated,
	}, nil
}

func (s *Service) DeleteSession(ctx context.Context, orgID int64, signedInUser *user.SignedInUser, sessionUID string) (*cloudmigration.CloudMigrationSession, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.DeleteSession")
	defer span.End()

	session, snapshots, err := s.store.DeleteMigrationSessionByUID(ctx, orgID, sessionUID)
	if err != nil {
		s.report(ctx, session, gmsclient.EventDisconnect, 0, err, signedInUser.UserUID)
		return nil, fmt.Errorf("deleting migration from db for session %v: %w", sessionUID, err)
	}

	err = s.deleteLocalFiles(snapshots)
	s.report(ctx, session, gmsclient.EventDisconnect, 0, err, signedInUser.UserUID)
	return session, nil
}

func (s *Service) CreateSnapshot(ctx context.Context, signedInUser *user.SignedInUser, cmd cloudmigration.CreateSnapshotCommand) (*cloudmigration.CloudMigrationSnapshot, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.CreateSnapshot", trace.WithAttributes(
		attribute.String("sessionUid", cmd.SessionUID),
	))
	defer span.End()

	if s.cfg.CloudMigration.SnapshotFolder == "" {
		return nil, fmt.Errorf("snapshot folder is not set")
	}

	// fetch session for the gms auth token
	session, err := s.store.GetMigrationSessionByUID(ctx, signedInUser.GetOrgID(), cmd.SessionUID)
	if err != nil {
		return nil, fmt.Errorf("fetching migration session for uid %s: %w", cmd.SessionUID, err)
	}

	// query gms to establish new snapshot s.cfg.CloudMigration.StartSnapshotTimeout
	initResp, err := s.gmsClient.StartSnapshot(ctx, *session)
	if err != nil {
		return nil, fmt.Errorf("initializing snapshot with GMS for session %s: %w", cmd.SessionUID, err)
	}

	// save snapshot to the db
	snapshot := cloudmigration.CloudMigrationSnapshot{
		UID:                 util.GenerateShortUID(),
		SessionUID:          cmd.SessionUID,
		Status:              cloudmigration.SnapshotStatusCreating,
		GMSPublicKey:        initResp.GMSPublicKey,
		GMSSnapshotUID:      initResp.SnapshotID,
		Metadata:            initResp.Metadata,
		EncryptionAlgo:      initResp.Algo,
		LocalDir:            filepath.Join(s.cfg.CloudMigration.SnapshotFolder, "grafana", "snapshots", initResp.SnapshotID),
		ResourceStorageType: s.cfg.CloudMigration.ResourceStorageType,
	}

	if err := s.store.CreateSnapshot(ctx, snapshot); err != nil {
		return nil, fmt.Errorf("saving snapshot: %w", err)
	}

	// Update status to "creating" to ensure the frontend polls from now on
	if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
		UID:       snapshot.UID,
		SessionID: cmd.SessionUID,
		Status:    cloudmigration.SnapshotStatusCreating,
	}); err != nil {
		return nil, err
	}

	// start building the snapshot asynchronously while we return a success response to the client
	go func() {
		s.cancelMutex.Lock()
		defer func() {
			s.cancelFunc = nil
			s.cancelMutex.Unlock()
		}()

		// Create context out the span context to ensure the trace is propagated
		asyncCtx := trace.ContextWithSpanContext(context.Background(), span.SpanContext())
		asyncCtx, asyncSpan := s.tracer.Start(asyncCtx, "CloudMigrationService.CreateSnapshotAsync")
		defer asyncSpan.End()

		asyncCtx, cancelFunc := context.WithCancel(asyncCtx)
		s.cancelFunc = cancelFunc

		s.report(asyncCtx, session, gmsclient.EventStartBuildingSnapshot, 0, nil, signedInUser.UserUID)

		start := time.Now()

		err := s.buildSnapshot(asyncCtx, signedInUser, initResp.MaxItemsPerPartition, initResp.Metadata, snapshot, cmd.ResourceTypes)
		if err != nil {
			asyncSpan.SetStatus(codes.Error, "error building snapshot")
			asyncSpan.RecordError(err)
			s.log.Error("building snapshot", "err", err.Error())

			// Update status to error with retries
			if err := s.updateSnapshotWithRetries(asyncCtx, cloudmigration.UpdateSnapshotCmd{
				UID:       snapshot.UID,
				SessionID: cmd.SessionUID,
				Status:    cloudmigration.SnapshotStatusError,
			}); err != nil {
				s.log.Error("critical failure during snapshot creation - please report any error logs")
				asyncSpan.RecordError(err)
			}
		}

		span.SetStatus(codes.Ok, "snapshot built")
		s.report(asyncCtx, session, gmsclient.EventDoneBuildingSnapshot, time.Since(start), err, signedInUser.UserUID)
	}()

	return &snapshot, nil
}

// GetSnapshot returns the on-prem version of a snapshot, supplemented with processing status from GMS
func (s *Service) GetSnapshot(ctx context.Context, query cloudmigration.GetSnapshotsQuery) (*cloudmigration.CloudMigrationSnapshot, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetSnapshot")
	defer span.End()

	orgID, sessionUid, snapshotUid := query.OrgID, query.SessionUID, query.SnapshotUID
	snapshot, err := s.store.GetSnapshotByUID(ctx, orgID, sessionUid, snapshotUid, query.SnapshotResultQueryParams)
	if err != nil {
		return nil, fmt.Errorf("fetching snapshot for uid %s: %w", snapshotUid, err)
	}

	session, err := s.store.GetMigrationSessionByUID(ctx, orgID, sessionUid)
	if err != nil {
		return nil, fmt.Errorf("fetching session for uid %s: %w", sessionUid, err)
	}

	// FIXME: this function should be a method
	syncStatus := func(ctx context.Context, session *cloudmigration.CloudMigrationSession, snapshot *cloudmigration.CloudMigrationSnapshot) (*cloudmigration.CloudMigrationSnapshot, error) {
		// Calculate offset based on how many results we currently have responses for
		pending := snapshot.StatsRollup.CountsByStatus[cloudmigration.ItemStatusPending]
		snapshotMeta, err := s.gmsClient.GetSnapshotStatus(ctx, *session, *snapshot, snapshot.StatsRollup.Total-pending)
		if err != nil {
			return snapshot, fmt.Errorf("error fetching snapshot status from GMS: sessionUid: %s, snapshotUid: %s", sessionUid, snapshotUid)
		}

		if snapshotMeta.State == cloudmigration.SnapshotStateUnknown {
			// If a status from Grafana Migration Service is unavailable, return the snapshot as-is
			return snapshot, nil
		}

		localStatus, ok := gmsStateToLocalStatus[snapshotMeta.State]
		if !ok {
			s.log.Error("unexpected GMS snapshot state: %s", snapshotMeta.State)
			return snapshot, nil
		}
		resources := snapshotMeta.Results

		// Log the errors for resources with errors at migration
		for _, resource := range resources {
			if resource.Status == cloudmigration.ItemStatusError && resource.Error != "" {
				s.log.Error("Could not migrate resource", "resourceID", resource.RefID, "error", resource.Error)
			}
		}

		// We need to update the snapshot in our db before reporting anything
		if err := s.store.UpdateSnapshot(ctx, cloudmigration.UpdateSnapshotCmd{
			UID:                    snapshot.UID,
			SessionID:              sessionUid,
			Status:                 localStatus,
			CloudResourcesToUpdate: resources,
		}); err != nil {
			return nil, fmt.Errorf("error updating snapshot status: %w", err)
		}

		// Refresh the snapshot after the update
		snapshot, err = s.store.GetSnapshotByUID(ctx, orgID, sessionUid, snapshotUid, query.SnapshotResultQueryParams)
		if err != nil {
			return nil, fmt.Errorf("fetching snapshot for uid %s: %w", snapshotUid, err)
		}
		return snapshot, nil
	}

	// Create a context out the span context to ensure the trace is propagated
	asyncSyncCtx := trace.ContextWithSpanContext(context.Background(), span.SpanContext())
	// Sync snapshot results from GMS if the one created after upload is not running (e.g. due to a restart)
	// and anybody is interested in the status.
	go s.syncSnapshotStatusFromGMSUntilDone(asyncSyncCtx, session, snapshot, syncStatus)

	return snapshot, nil
}

// FIXME: this definition should not exist once the function is GetSnapshot is converted to a method
type syncStatusFunc func(context.Context, *cloudmigration.CloudMigrationSession, *cloudmigration.CloudMigrationSnapshot) (*cloudmigration.CloudMigrationSnapshot, error)

func (s *Service) syncSnapshotStatusFromGMSUntilDone(ctx context.Context, session *cloudmigration.CloudMigrationSession, snapshot *cloudmigration.CloudMigrationSnapshot, syncStatus syncStatusFunc) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.syncSnapshotStatusFromGMSUntilDone")
	span.SetAttributes(
		attribute.String("sessionUID", session.UID),
		attribute.String("snapshotUID", snapshot.UID),
	)
	defer span.End()

	// Ensure only one in-flight sync running
	if !atomic.CompareAndSwapInt32(&s.isSyncSnapshotStatusFromGMSRunning, 0, 1) {
		s.log.Info("synchronize snapshot status already running", "sessionUID", session.UID, "snapshotUID", snapshot.UID)
		return
	}
	defer atomic.StoreInt32(&s.isSyncSnapshotStatusFromGMSRunning, 0)

	if !snapshot.ShouldQueryGMS() {
		return
	}

	s.cancelMutex.Lock()
	defer func() {
		s.cancelFunc = nil
		s.cancelMutex.Unlock()
	}()

	ctx, s.cancelFunc = context.WithCancel(ctx)

	updatedSnapshot, err := syncStatus(ctx, session, snapshot)
	if err != nil {
		s.log.Error("error fetching snapshot status from GMS", "error", err, "sessionUID", session.UID, "snapshotUID", snapshot.UID)
	} else {
		snapshot = updatedSnapshot
	}

	tick := time.NewTicker(10 * time.Second)
	defer tick.Stop()

	for snapshot.ShouldQueryGMS() {
		select {
		case <-ctx.Done():
			s.log.Info("cancelling snapshot status polling", "sessionUID", session.UID, "snapshotUID", snapshot.UID)
			return
		case <-tick.C:
			updatedSnapshot, err := syncStatus(ctx, session, snapshot)
			if err != nil {
				s.log.Error("error fetching snapshot status from GMS", "error", err, "sessionUID", session.UID, "snapshotUID", snapshot.UID)
				continue
			}
			snapshot = updatedSnapshot
		}
	}
}

var gmsStateToLocalStatus map[cloudmigration.SnapshotState]cloudmigration.SnapshotStatus = map[cloudmigration.SnapshotState]cloudmigration.SnapshotStatus{
	cloudmigration.SnapshotStateInitialized: cloudmigration.SnapshotStatusPendingProcessing, // GMS has not yet received a notification for the data
	cloudmigration.SnapshotStateProcessing:  cloudmigration.SnapshotStatusProcessing,        // GMS has received a notification and is migrating the data
	cloudmigration.SnapshotStateFinished:    cloudmigration.SnapshotStatusFinished,          // GMS has completed the migration - all resources were attempted to be migrated
	cloudmigration.SnapshotStateCanceled:    cloudmigration.SnapshotStatusCanceled,          // GMS has processed a cancelation request. Snapshot cancelation is not supported yet.
	cloudmigration.SnapshotStateError:       cloudmigration.SnapshotStatusError,             // Something unrecoverable has occurred in the migration process.
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

func (s *Service) UploadSnapshot(ctx context.Context, orgID int64, signedInUser *user.SignedInUser, sessionUid string, snapshotUid string) error {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.UploadSnapshot",
		trace.WithAttributes(
			attribute.String("sessionUid", sessionUid),
			attribute.String("snapshotUid", snapshotUid),
		),
	)
	defer span.End()

	// fetch session for the gms auth token
	session, err := s.store.GetMigrationSessionByUID(ctx, orgID, sessionUid)
	if err != nil {
		return fmt.Errorf("fetching migration session for uid %s: %w", sessionUid, err)
	}

	snapshot, err := s.GetSnapshot(ctx, cloudmigration.GetSnapshotsQuery{
		SnapshotUID: snapshotUid,
		SessionUID:  sessionUid,
		OrgID:       orgID,
	})
	if err != nil {
		return fmt.Errorf("fetching snapshot with uid %s: %w", snapshotUid, err)
	}

	uploadUrl, err := s.gmsClient.CreatePresignedUploadUrl(ctx, *session, *snapshot)
	if err != nil {
		return fmt.Errorf("creating presigned upload url for snapshot %s: %w", snapshotUid, err)
	}

	s.log.Info("Uploading snapshot in local directory", "gmsSnapshotUID", snapshot.GMSSnapshotUID, "localDir", snapshot.LocalDir, "uploadURL", uploadUrl)

	// Update status to "uploading" to ensure the frontend polls from now on
	if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
		UID:       snapshotUid,
		SessionID: sessionUid,
		Status:    cloudmigration.SnapshotStatusUploading,
	}); err != nil {
		return err
	}

	// start uploading the snapshot asynchronously while we return a success response to the client
	go func() {
		s.cancelMutex.Lock()
		defer func() {
			s.cancelFunc = nil
			s.cancelMutex.Unlock()
		}()

		// Create context out the span context to ensure the trace is propagated
		asyncCtx := trace.ContextWithSpanContext(context.Background(), span.SpanContext())
		asyncCtx, asyncSpan := s.tracer.Start(asyncCtx, "CloudMigrationService.UploadSnapshot")
		defer asyncSpan.End()

		asyncCtx, s.cancelFunc = context.WithCancel(asyncCtx)

		s.report(asyncCtx, session, gmsclient.EventStartUploadingSnapshot, 0, nil, signedInUser.UserUID)

		start := time.Now()
		err := s.uploadSnapshot(asyncCtx, session, snapshot, uploadUrl)
		if err != nil {
			asyncSpan.SetStatus(codes.Error, "error uploading snapshot")
			asyncSpan.RecordError(err)

			s.log.Error("uploading snapshot", "err", err.Error())
			// Update status to error with retries
			if err := s.updateSnapshotWithRetries(asyncCtx, cloudmigration.UpdateSnapshotCmd{
				UID:       snapshot.UID,
				SessionID: sessionUid,
				Status:    cloudmigration.SnapshotStatusError,
			}); err != nil {
				asyncSpan.RecordError(err)
				s.log.Error("critical failure during snapshot upload - please report any error logs")
			}
		}

		s.report(asyncCtx, session, gmsclient.EventDoneUploadingSnapshot, time.Since(start), err, signedInUser.UserUID)
	}()

	return nil
}

func (s *Service) CancelSnapshot(ctx context.Context, sessionUid string, snapshotUid string) (err error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.CancelSnapshot",
		trace.WithAttributes(
			attribute.String("sessionUid", sessionUid),
			attribute.String("snapshotUid", snapshotUid),
		),
	)
	defer span.End()

	// The cancel func itself is protected by a mutex in the async threads, so it may or may not be set by the time CancelSnapshot is called
	// Attempt to cancel and recover from the panic if the cancel function is nil
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("nothing to cancel")
		}
	}()
	s.cancelFunc()

	// Canceling will ensure that any goroutines holding the lock finish and release the lock
	s.cancelMutex.Lock()
	defer s.cancelMutex.Unlock()
	s.cancelFunc = nil

	if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
		UID:       snapshotUid,
		SessionID: sessionUid,
		Status:    cloudmigration.SnapshotStatusCanceled,
	}); err != nil {
		s.log.Error("critical failure during snapshot cancelation - please report any error logs")
	}

	s.log.Info("canceled snapshot", "sessionUid", sessionUid, "snapshotUid", snapshotUid)

	return nil
}

func (s *Service) report(
	ctx context.Context,
	sess *cloudmigration.CloudMigrationSession,
	t gmsclient.LocalEventType,
	d time.Duration,
	evtErr error,
	userUID string,
) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.report")
	defer span.End()

	id, err := s.getLocalEventId(ctx)
	if err != nil {
		s.log.Error("failed to report event", "type", t, "error", err.Error())
		return
	}

	if sess == nil {
		errMessage := "session not found"
		if evtErr != nil {
			errMessage = evtErr.Error()
		}

		s.log.Error("failed to report event", "type", t, "error", errMessage)

		return
	}

	e := gmsclient.EventRequestDTO{
		Event:          t,
		LocalID:        id,
		UserUID:        userUID,
		GrafanaVersion: s.grafanaVersion,
	}

	if d != 0 {
		e.DurationIfFinished = d
	}
	if evtErr != nil {
		e.Error = evtErr.Error()
	}

	s.gmsClient.ReportEvent(ctx, *sess, e)
}

func (s *Service) getLocalEventId(ctx context.Context) (string, error) {
	anonId, ok, err := s.kvStore.Get(ctx, "anonymous_id")
	if err != nil {
		return "", fmt.Errorf("failed to get usage stats id: %w", err)
	}

	if ok {
		return anonId, nil
	}

	anonId = uuid.NewString()

	err = s.kvStore.Set(ctx, "anonymous_id", anonId)
	if err != nil {
		s.log.Error("Failed to store usage stats id", "error", err)
		return "", fmt.Errorf("failed to store usage stats id: %w", err)
	}

	return anonId, nil
}

func (s *Service) deleteLocalFiles(snapshots []cloudmigration.CloudMigrationSnapshot) error {
	_, span := s.tracer.Start(context.Background(), "CloudMigrationService.deleteLocalFiles")
	defer span.End()

	var err error
	for _, snapshot := range snapshots {
		if snapshot.LocalDir != "" {
			err = os.RemoveAll(snapshot.LocalDir)
			if err != nil {
				// in this case we only log the error, don't return it to continue with the process
				s.log.Error("deleting migration snapshot files", "err", err)
			}
		}
	}
	return err
}
