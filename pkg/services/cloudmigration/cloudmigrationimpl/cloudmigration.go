package cloudmigrationimpl

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/api"
	"github.com/grafana/grafana/pkg/services/cloudmigration/cmsclient"
	"github.com/grafana/grafana/pkg/services/cloudmigration/slicesext"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Service Define the cloudmigration.Service Implementation.
type Service struct {
	store store

	log *log.ConcreteLogger
	cfg *setting.Cfg

	features  featuremgmt.FeatureToggles
	cmsClient cmsclient.Client

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
		// get CMS path from the config
		domain, err := s.parseCloudMigrationConfig()
		if err != nil {
			return nil, fmt.Errorf("config parse error: %w", err)
		}
		s.cmsClient = cmsclient.NewCMSClient(domain)

		s.gcomService = gcom.New(gcom.Config{ApiURL: cfg.GrafanaComAPIURL, Token: cfg.CloudMigration.GcomAPIToken})
	} else {
		s.cmsClient = cmsclient.NewInMemoryClient()
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
			ClusterSlug: instance.ClusterSlug, // This should be used for routing to CMS
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

func (s *Service) ValidateToken(ctx context.Context, cm cloudmigration.CloudMigration) error {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.ValidateToken")
	defer span.End()

	if err := s.cmsClient.ValidateKey(ctx, cm); err != nil {
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

func (s *Service) GetMigration(ctx context.Context, uid string) (*cloudmigration.CloudMigration, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.GetMigration")
	defer span.End()
	migration, err := s.store.GetMigrationByUID(ctx, uid)
	if err != nil {
		return nil, err
	}

	return migration, nil
}

func (s *Service) GetMigrationList(ctx context.Context) (*cloudmigration.CloudMigrationListResponse, error) {
	values, err := s.store.GetAllCloudMigrations(ctx)
	if err != nil {
		return nil, err
	}

	migrations := make([]cloudmigration.CloudMigrationResponse, 0)
	for _, v := range values {
		migrations = append(migrations, cloudmigration.CloudMigrationResponse{
			UID:     v.UID,
			Stack:   v.Stack,
			Created: v.Created,
			Updated: v.Updated,
		})
	}
	return &cloudmigration.CloudMigrationListResponse{Migrations: migrations}, nil
}

func (s *Service) CreateMigration(ctx context.Context, cmd cloudmigration.CloudMigrationRequest) (*cloudmigration.CloudMigrationResponse, error) {
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
	// validate token against cms before saving
	if err := s.ValidateToken(ctx, migration); err != nil {
		return nil, fmt.Errorf("token validation: %w", err)
	}

	cm, err := s.store.CreateMigration(ctx, migration)
	if err != nil {
		return nil, fmt.Errorf("error creating migration: %w", err)
	}

	return &cloudmigration.CloudMigrationResponse{
		UID:     cm.UID,
		Stack:   token.Instance.Slug,
		Created: cm.Created,
		Updated: cm.Updated,
	}, nil
}

func (s *Service) UpdateMigration(ctx context.Context, uid string, request cloudmigration.CloudMigrationRequest) (*cloudmigration.CloudMigrationResponse, error) {
	// TODO: Implement method
	return nil, nil
}

func (s *Service) RunMigration(ctx context.Context, uid string) (*cloudmigration.MigrateDataResponseDTO, error) {
	// Get migration to read the auth token
	migration, err := s.GetMigration(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("migration get error: %w", err)
	}

	// Get migration data JSON
	request, err := s.getMigrationDataJSON(ctx)
	if err != nil {
		s.log.Error("error getting the json request body for migration run", "err", err.Error())
		return nil, fmt.Errorf("migration data get error: %w", err)
	}

	// Call the cms service
	resp, err := s.cmsClient.MigrateData(ctx, *migration, *request)
	if err != nil {
		s.log.Error("error migrating data: %w", err)
		return nil, fmt.Errorf("migrate data error: %w", err)
	}

	// TODO update cloud migration run schema to treat the result as a first-class citizen
	respData, err := json.Marshal(resp)
	if err != nil {
		s.log.Error("error marshalling migration response data: %w", err)
		return nil, fmt.Errorf("marshalling migration response data: %w", err)
	}

	// save the result of the migration
	runUID, err := s.CreateMigrationRun(ctx, cloudmigration.CloudMigrationRun{
		CloudMigrationUID: migration.UID,
		Result:            respData,
	})
	if err != nil {
		response.Error(http.StatusInternalServerError, "migration run save error", err)
	}

	resp.RunUID = runUID

	return resp, nil
}

func (s *Service) getMigrationDataJSON(ctx context.Context) (*cloudmigration.MigrateDataRequestDTO, error) {
	var migrationDataSlice []cloudmigration.MigrateDataRequestItemDTO
	// Data sources
	dataSources, err := s.getDataSources(ctx)
	if err != nil {
		s.log.Error("Failed to get datasources", "err", err)
		return nil, err
	}
	for _, ds := range dataSources {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItemDTO{
			Type:  cloudmigration.DatasourceDataType,
			RefID: ds.UID,
			Name:  ds.Name,
			Data:  ds,
		})
	}

	// Dashboards
	dashboards, err := s.getDashboards(ctx)
	if err != nil {
		s.log.Error("Failed to get dashboards", "err", err)
		return nil, err
	}

	for _, dashboard := range dashboards {
		dashboard.Data.Del("id")
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItemDTO{
			Type:  cloudmigration.DashboardDataType,
			RefID: dashboard.UID,
			Name:  dashboard.Title,
			Data:  map[string]any{"dashboard": dashboard.Data},
		})
	}

	// Folders
	folders, err := s.getFolders(ctx)
	if err != nil {
		s.log.Error("Failed to get folders", "err", err)
		return nil, err
	}

	for _, f := range folders {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItemDTO{
			Type:  cloudmigration.FolderDataType,
			RefID: f.UID,
			Name:  f.Title,
			Data:  f,
		})
	}
	migrationData := &cloudmigration.MigrateDataRequestDTO{
		Items: migrationDataSlice,
	}

	return migrationData, nil
}

func (s *Service) getDataSources(ctx context.Context) ([]datasources.AddDataSourceCommand, error) {
	dataSources, err := s.dsService.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		s.log.Error("Failed to get all datasources", "err", err)
		return nil, err
	}

	result := []datasources.AddDataSourceCommand{}
	for _, dataSource := range dataSources {
		// Decrypt secure json to send raw credentials
		decryptedData, err := s.secretsService.DecryptJsonData(ctx, dataSource.SecureJsonData)
		if err != nil {
			s.log.Error("Failed to decrypt secure json data", "err", err)
			return nil, err
		}
		dataSourceCmd := datasources.AddDataSourceCommand{
			OrgID:           dataSource.OrgID,
			Name:            dataSource.Name,
			Type:            dataSource.Type,
			Access:          dataSource.Access,
			URL:             dataSource.URL,
			User:            dataSource.User,
			Database:        dataSource.Database,
			BasicAuth:       dataSource.BasicAuth,
			BasicAuthUser:   dataSource.BasicAuthUser,
			WithCredentials: dataSource.WithCredentials,
			IsDefault:       dataSource.IsDefault,
			JsonData:        dataSource.JsonData,
			SecureJsonData:  decryptedData,
			ReadOnly:        dataSource.ReadOnly,
			UID:             dataSource.UID,
		}
		result = append(result, dataSourceCmd)
	}
	return result, err
}

func (s *Service) getFolders(ctx context.Context) ([]folder.Folder, error) {
	reqCtx := contexthandler.FromContext(ctx)
	folders, err := s.folderService.GetFolders(ctx, folder.GetFoldersQuery{
		SignedInUser: reqCtx.SignedInUser,
	})
	if err != nil {
		return nil, err
	}

	var result []folder.Folder
	for _, folder := range folders {
		result = append(result, *folder)
	}

	return result, nil
}

func (s *Service) getDashboards(ctx context.Context) ([]dashboards.Dashboard, error) {
	dashs, err := s.dashboardService.GetAllDashboards(ctx)
	if err != nil {
		return nil, err
	}

	var result []dashboards.Dashboard
	for _, dashboard := range dashs {
		result = append(result, *dashboard)
	}
	return result, nil
}

func (s *Service) CreateMigrationRun(ctx context.Context, cmr cloudmigration.CloudMigrationRun) (string, error) {
	uid, err := s.store.CreateMigrationRun(ctx, cmr)
	if err != nil {
		s.log.Error("Failed to save migration run", "err", err)
		return "", err
	}
	return uid, nil
}

func (s *Service) GetMigrationStatus(ctx context.Context, runUID string) (*cloudmigration.CloudMigrationRun, error) {
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

	runList := &cloudmigration.CloudMigrationRunList{Runs: []cloudmigration.MigrateDataResponseListDTO{}}
	for _, s := range runs {
		runList.Runs = append(runList.Runs, cloudmigration.MigrateDataResponseListDTO{
			RunUID: s.UID,
		})
	}

	return runList, nil
}

func (s *Service) DeleteMigration(ctx context.Context, uid string) (*cloudmigration.CloudMigration, error) {
	c, err := s.store.DeleteMigration(ctx, uid)
	if err != nil {
		return c, fmt.Errorf("deleting migration from db: %w", err)
	}
	return c, nil
}

func (s *Service) CreateSnapshot(ctx context.Context, migrationUID string) error {
	// Get migration to read the auth token
	migration, err := s.GetMigration(ctx, migrationUID)
	if err != nil {
		return fmt.Errorf("migration get error: %w", err)
	}

	migrationData, err := s.getMigrationDataJSON(ctx)
	if err != nil {
		return fmt.Errorf("fetching migration data: %w", err)
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, s.cfg.CloudMigration.StartSnapshotTimeout)
	defer cancel()
	snapshotInfo, err := s.cmsClient.StartSnapshot(timeoutCtx, migration)
	if err != nil {
		return fmt.Errorf("sending request to gms to start snapshot: %w", err)
	}

	snapshot, err := NewSnapshotWriter(filepath.Join(s.cfg.CloudMigration.SnapshotFolder, "grafana", "snapshots", snapshotInfo.SnapshotID))
	if err != nil {
		return fmt.Errorf("instantiating snapshot writer: %w", err)
	}

	resourcesGroupedByType := make(map[cloudmigration.MigrateDataType][]cloudmigration.MigrateDataRequestItemDTO, 0)
	for _, item := range migrationData.Items {
		resourcesGroupedByType[item.Type] = append(resourcesGroupedByType[item.Type], item)
	}

	for _, resourceType := range []cloudmigration.MigrateDataType{
		cloudmigration.DatasourceDataType,
		cloudmigration.FolderDataType,
		cloudmigration.DashboardDataType,
	} {
		for _, chunk := range slicesext.Chunks(int(snapshotInfo.MaxItemsPerPartition), resourcesGroupedByType[resourceType]) {
			if err := snapshot.Write(string(resourceType), chunk); err != nil {
				return fmt.Errorf("writing resources to snapshot writer: resourceType=%s %w", resourceType, err)
			}
		}
	}

	_, err = snapshot.Finish()
	if err != nil {
		return fmt.Errorf("finishing writing snapshot files and generating index file: %w", err)
	}

	return nil
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
