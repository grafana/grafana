package cloudmigrationimpl

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/api"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// CloudMigrationsServiceImpl Define the Service Implementation.
type Service struct {
	store store

	log *log.ConcreteLogger
	cfg *setting.Cfg

	features    featuremgmt.FeatureToggles
	dsService   datasources.DataSourceService
	gcomService gcom.Service

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
	routeRegister routing.RouteRegister,
	prom prometheus.Registerer,
	tracer tracing.Tracer,
) cloudmigration.Service {
	if !features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrations) {
		return &NoopServiceImpl{}
	}

	s := &Service{
		store:       &sqlStore{db: db},
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

func (s *Service) ValidateToken(ctx context.Context, token string) error {
	// TODO: Implement method
	return nil
}

func (s *Service) SaveEncryptedToken(ctx context.Context, token string) error {
	// TODO: Implement method
	return nil
}

func (s *Service) GetMigration(ctx context.Context, id int64) (*cloudmigration.CloudMigrationResponse, error) {
	// TODO: Implement method
	return nil, nil
}

func (s *Service) GetMigrationList(ctx context.Context) ([]cloudmigration.CloudMigrationResponse, error) {
	// TODO: Implement method
	return nil, nil
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

	if err := s.store.CreateMigration(ctx, token); err != nil {
		return nil, fmt.Errorf("error creating migration: %w", err)
	}

	return &cloudmigration.CloudMigrationResponse{
		ID:    int64(token.Instance.StackID),
		Stack: token.Instance.Slug,
		// TODO replace this with the actual value once the storage piece is implemented
		Created: time.Now(),
		Updated: time.Now(),
	}, nil
}

func (s *Service) UpdateMigration(ctx context.Context, id int64, cm cloudmigration.CloudMigrationRequest) (*cloudmigration.CloudMigrationResponse, error) {
	// TODO: Implement method
	return nil, nil
}

func (s *Service) RunMigration(ctx context.Context, uid string) (*cloudmigration.CloudMigrationRun, error) {
	// TODO: Implement method
	return nil, nil
}

func (s *Service) GetMigrationStatus(ctx context.Context, id string, runID string) (*cloudmigration.CloudMigrationRun, error) {
	// TODO: Implement method
	return nil, nil
}

func (s *Service) GetMigrationStatusList(ctx context.Context, id string) ([]cloudmigration.CloudMigrationRun, error) {
	// TODO: Implement method
	return nil, nil
}

func (s *Service) DeleteMigration(ctx context.Context, id string) error {
	// TODO: Implement method
	return nil
}

// func (s *Service) MigrateDatasources(ctx context.Context, request *cloudmigration.MigrateDatasourcesRequest) (*cloudmigration.MigrateDatasourcesResponse, error) {
// 	return s.store.MigrateDatasources(ctx, request)
// }
