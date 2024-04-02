package cloudmigrationimpl

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/api"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/client_golang/prometheus"
)

// Service Define the cloudmigration.Service Implementation.
type Service struct {
	store store

	log *log.ConcreteLogger
	cfg *setting.Cfg

	features featuremgmt.FeatureToggles

	dsService       datasources.DataSourceService
	gcomService     gcom.Service
	dashboarService dashboards.DashboardService
	folderService   folder.Service
	secretsService  secrets.Service

	api     *api.CloudMigrationAPI
	tracer  tracing.Tracer
	metrics *Metrics
}

var LogPrefix = "cloudmigration.service"

const (
	// nolint:gosec
	cloudMigrationAccessPolicyName = "grafana-cloud-migrations"
	//nolint:gosec
	cloudMigrationTokenName = "grafana-cloud-migrations"
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
) cloudmigration.Service {
	if !features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrations) {
		return &NoopServiceImpl{}
	}

	s := &Service{
		store:       &sqlStore{db: db, secretsService: secretsService},
		log:         log.New(LogPrefix),
		cfg:         cfg,
		features:    features,
		dsService:   dsService,
		gcomService: gcom.New(gcom.Config{ApiURL: cfg.GrafanaComAPIURL, Token: cfg.CloudMigration.GcomAPIToken}),
		tracer:      tracer,
		metrics:     newMetrics(),
	}
	s.api = api.RegisterApi(routeRegister, s, tracer)

	if err := s.registerMetrics(prom, s.metrics); err != nil {
		s.log.Warn("error registering prom metrics", "error", err.Error())
	}

	return s
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

	timeoutCtx, cancel = context.WithTimeout(ctx, s.cfg.CloudMigration.FetchAccessPolicyTimeout)
	defer cancel()
	existingAccessPolicy, err := s.findAccessPolicyByName(timeoutCtx, instance.RegionSlug, cloudMigrationAccessPolicyName)
	if err != nil {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("fetching access policy by name: name=%s %w", cloudMigrationAccessPolicyName, err)
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
			Name:        cloudMigrationAccessPolicyName,
			DisplayName: cloudMigrationAccessPolicyName,
			Realms:      []gcom.Realm{{Type: "stack", Identifier: s.cfg.StackID, LabelPolicies: []gcom.LabelPolicy{}}},
			Scopes:      []string{"cloud-migrations:read", "cloud-migrations:write"},
		})
	if err != nil {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("creating access policy: %w", err)
	}
	logger.Info("created access policy", "id", accessPolicy.ID, "name", accessPolicy.Name)

	timeoutCtx, cancel = context.WithTimeout(ctx, s.cfg.CloudMigration.CreateTokenTimeout)
	defer cancel()
	token, err := s.gcomService.CreateToken(timeoutCtx,
		gcom.CreateTokenParams{RequestID: requestID, Region: instance.RegionSlug},
		gcom.CreateTokenPayload{
			AccessPolicyID: accessPolicy.ID,
			DisplayName:    cloudMigrationTokenName,
			Name:           cloudMigrationTokenName,
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
	logger := s.log.FromContext(ctx)

	// get CMS path from the config
	domain, err := s.ParseCloudMigrationConfig()
	if err != nil {
		return fmt.Errorf("config parse error: %w", err)
	}
	path := fmt.Sprintf("https://cms-dev-%s.%s/cloud-migrations/api/v1/validate-key", cm.ClusterSlug, domain)

	// validation is an empty POST to CMS with the authorization header included
	req, err := http.NewRequest("POST", path, bytes.NewReader(nil))
	if err != nil {
		logger.Error("error creating http request for token validation", "err", err.Error())
		return fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", cm.StackID, cm.AuthToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		logger.Error("error sending http request for token validation", "err", err.Error())
		return fmt.Errorf("http request error: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("closing request body", "err", err.Error())
		}
	}()

	if resp.StatusCode != 200 {
		var errResp map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
			logger.Error("decoding error response", "err", err.Error())
		} else {
			return fmt.Errorf("token validation failure: %v", errResp)
		}
	}

	return nil
}

func (s *Service) GetMigration(ctx context.Context, id int64) (*cloudmigration.CloudMigration, error) {
	migration, err := s.store.GetMigration(ctx, id)
	if err != nil {
		return nil, err
	}
	strValue := migration.AuthToken
	decoded, err := base64.RawStdEncoding.DecodeString(strValue)
	if err != nil {
		s.log.Error("Failed to decode secret string", "err", err, "value")
		return nil, err
	}

	decryptedToken, err := s.secretsService.Decrypt(ctx, decoded)
	if err != nil {
		s.log.Error("Failed to decrypt secret", "err", err)
		return nil, err
	}
	migration.AuthToken = string(decryptedToken)

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
			ID:      v.ID,
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

	if err := s.store.CreateMigration(ctx, migration); err != nil {
		return nil, fmt.Errorf("error creating migration: %w", err)
	}

	return &cloudmigration.CloudMigrationResponse{
		ID:      int64(token.Instance.StackID),
		Stack:   token.Instance.Slug,
		Created: time.Now(),
		Updated: time.Now(),
	}, nil
}

func (s *Service) UpdateMigration(ctx context.Context, id int64, cm cloudmigration.CloudMigrationRequest) (*cloudmigration.CloudMigrationResponse, error) {
	// TODO: Implement method
	return nil, nil
}

func (s *Service) GetMigrationDataJSON(ctx context.Context, id int64) ([]byte, error) {
	var migrationDataSlice []cloudmigration.MigrateDataRequestItemDTO
	// Data sources
	dataSources, err := s.getDataSources(ctx, id)
	if err != nil {
		s.log.Error("Failed to get datasources", "err", err)
		return nil, err
	}
	migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItemDTO{
		Type:  cloudmigration.DatasourceDataType,
		RefID: strconv.Itoa(int(id)),
		Name:  "datasources",
		Data:  dataSources,
	})
	// Dashboards
	dashboards, err := s.getDashboards(ctx, id)
	if err != nil {
		s.log.Error("Failed to get dashboards", "err", err)
		return nil, err
	}
	migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItemDTO{
		Type:  cloudmigration.DashboardDataType,
		RefID: strconv.Itoa(int(id)),
		Name:  "dashboards",
		Data:  dashboards,
	})
	// Folders
	folders, err := s.getFolders(ctx, id)
	if err != nil {
		s.log.Error("Failed to get folders", "err", err)
		return nil, err
	}
	migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItemDTO{
		Type:  cloudmigration.FolderDataType,
		RefID: strconv.Itoa(int(id)),
		Name:  "folders",
		Data:  folders,
	})
	migrationData := cloudmigration.MigrateDataRequestDTO{
		Items: migrationDataSlice,
	}
	result, err := json.Marshal(migrationData)
	if err != nil {
		s.log.Error("Failed to marshal datasources", "err", err)
		return nil, err
	}
	return result, nil
}

func (s *Service) getDataSources(ctx context.Context, id int64) ([]datasources.AddDataSourceCommand, error) {
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

func (s *Service) getFolders(ctx context.Context, id int64) ([]folder.Folder, error) {
	folders, err := s.folderService.GetFolders(ctx, folder.GetFoldersQuery{})
	if err != nil {
		return nil, err
	}

	var result []folder.Folder
	for _, folder := range folders {
		result = append(result, *folder)
	}

	return result, nil
}

func (s *Service) getDashboards(ctx context.Context, id int64) ([]dashboards.Dashboard, error) {
	dashs, err := s.dashboarService.GetAllDashboards(ctx)
	if err != nil {
		return nil, err
	}

	var result []dashboards.Dashboard
	for _, dashboard := range dashs {
		result = append(result, *dashboard)
	}
	return result, nil
}

func (s *Service) SaveMigrationRun(ctx context.Context, cmr *cloudmigration.CloudMigrationRun) (string, error) {
	cmr.CloudMigrationUID = util.GenerateShortUID()
	cmr.Created = time.Now()
	cmr.Updated = time.Now()
	cmr.Finished = time.Now()
	err := s.store.SaveMigrationRun(ctx, cmr)
	if err != nil {
		s.log.Error("Failed to save migration run", "err", err)
		return "", err
	}
	return cmr.CloudMigrationUID, nil
}

func (s *Service) GetMigrationStatus(ctx context.Context, id string, runID string) (*cloudmigration.CloudMigrationRun, error) {
	cmr, err := s.store.GetMigrationStatus(ctx, id, runID)
	if err != nil {
		return nil, fmt.Errorf("retrieving migration status from db: %w", err)
	}

	return cmr, nil
}

func (s *Service) GetMigrationStatusList(ctx context.Context, migrationID string) ([]*cloudmigration.CloudMigrationRun, error) {
	cmrs, err := s.store.GetMigrationStatusList(ctx, migrationID)
	if err != nil {
		return nil, fmt.Errorf("retrieving migration statuses from db: %w", err)
	}
	return cmrs, nil
}

func (s *Service) DeleteMigration(ctx context.Context, id int64) (*cloudmigration.CloudMigration, error) {
	c, err := s.store.DeleteMigration(ctx, id)
	if err != nil {
		return c, fmt.Errorf("deleting migration from db: %w", err)
	}
	return c, nil
}

func (s *Service) ParseCloudMigrationConfig() (string, error) {
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
