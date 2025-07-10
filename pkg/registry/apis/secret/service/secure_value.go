package service

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type SecureValueService struct {
	tracer                     trace.Tracer
	accessClient               claims.AccessClient
	database                   contracts.Database
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	keeperService              contracts.KeeperService
}

func ProvideSecureValueService(
	tracer trace.Tracer,
	accessClient claims.AccessClient,
	database contracts.Database,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService contracts.KeeperService,
) *SecureValueService {
	return &SecureValueService{
		tracer:                     tracer,
		accessClient:               accessClient,
		database:                   database,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService,
	}
}

func (s *SecureValueService) Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Create", trace.WithAttributes(
		attribute.String("name", sv.GetName()),
		attribute.String("namespace", sv.GetNamespace()),
		attribute.String("actor", actorUID),
	))
	defer span.End()
	return s.createNewVersion(ctx, sv, actorUID)
}

func (s *SecureValueService) Update(ctx context.Context, newSecureValue *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, bool, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Update", trace.WithAttributes(
		attribute.String("name", newSecureValue.GetName()),
		attribute.String("namespace", newSecureValue.GetNamespace()),
		attribute.String("actor", actorUID),
	))
	defer span.End()

	if newSecureValue.Spec.Value == "" {
		decrypted, err := s.secureValueMetadataStorage.ReadForDecrypt(ctx, xkube.Namespace(newSecureValue.Namespace), newSecureValue.Name)
		if err != nil {
			return nil, false, fmt.Errorf("reading secure value secret: %+w", err)
		}

		// TODO: does this need to be for update?
		keeperCfg, err := s.keeperMetadataStorage.GetKeeperConfig(ctx, newSecureValue.Namespace, newSecureValue.Spec.Keeper, contracts.ReadOpts{ForUpdate: true})
		if err != nil {
			return nil, false, fmt.Errorf("fetching keeper config: namespace=%+v keeperName=%+v %w", newSecureValue.Namespace, newSecureValue.Spec.Keeper, err)
		}

		keeper, err := s.keeperService.KeeperForConfig(keeperCfg)
		if err != nil {
			return nil, false, fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", newSecureValue.Namespace, newSecureValue.Spec.Keeper, err)
		}
		logging.FromContext(ctx).Debug("retrieved keeper", "namespace", newSecureValue.Namespace, "keeperName", newSecureValue.Spec.Keeper, "type", keeperCfg.Type())

		secret, err := keeper.Expose(ctx, keeperCfg, newSecureValue.Namespace, contracts.ExternalID(decrypted.ExternalID))
		if err != nil {
			return nil, false, fmt.Errorf("reading secret value from keeper: %w", err)
		}

		newSecureValue.Spec.Value = secret
	}

	const updateIsSync = true
	createdSv, err := s.createNewVersion(ctx, newSecureValue, actorUID)
	return createdSv, updateIsSync, err
}

func (s *SecureValueService) createNewVersion(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	createdSv, err := s.secureValueMetadataStorage.Create(ctx, sv, actorUID)
	if err != nil {
		return nil, fmt.Errorf("creating secure value: %w", err)
	}
	createdSv.Status = secretv0alpha1.SecureValueStatus{
		Version: createdSv.Status.Version,
	}

	// TODO: does this need to be for update?
	keeperCfg, err := s.keeperMetadataStorage.GetKeeperConfig(ctx, sv.Namespace, sv.Spec.Keeper, contracts.ReadOpts{ForUpdate: true})
	if err != nil {
		return nil, fmt.Errorf("fetching keeper config: namespace=%+v keeperName=%+v %w", sv.Namespace, sv.Spec.Keeper, err)
	}

	keeper, err := s.keeperService.KeeperForConfig(keeperCfg)
	if err != nil {
		return nil, fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", sv.Namespace, sv.Spec.Keeper, err)
	}
	logging.FromContext(ctx).Debug("retrieved keeper", "namespace", sv.Namespace, "keeperName", sv.Spec.Keeper, "type", keeperCfg.Type())

	// TODO: can we stop using external id?
	// TODO: store uses only the namespace and returns and id. It could be a kv instead.
	// TODO: check that the encrypted store works with multiple versions
	externalID, err := keeper.Store(ctx, keeperCfg, sv.Namespace, sv.Spec.Value.DangerouslyExposeAndConsumeValue())
	if err != nil {
		return nil, fmt.Errorf("storing secure value in keeper: %w", err)
	}
	createdSv.Status.ExternalID = string(externalID)

	if err := s.secureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace(sv.Namespace), sv.Name, createdSv.Status.Version, externalID); err != nil {
		return nil, fmt.Errorf("setting secure value external id: %w", err)
	}

	if err := s.secureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace(sv.Namespace), sv.Name, createdSv.Status.Version); err != nil {
		return nil, fmt.Errorf("marking secure value version as active: %w", err)
	}

	// In a single query:
	// TODO: set external id
	// TODO: set to active

	return createdSv, nil
}

func (s *SecureValueService) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Read", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	return s.secureValueMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{ForUpdate: false})
}

func (s *SecureValueService) List(ctx context.Context, namespace xkube.Namespace) (*secretv0alpha1.SecureValueList, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.List", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	hasPermissionFor, err := s.accessClient.Compile(ctx, user, claims.ListRequest{
		Group:     secretv0alpha1.GROUP,
		Resource:  secretv0alpha1.SecureValuesResourceInfo.GetName(),
		Namespace: namespace.String(),
		Verb:      utils.VerbGet, // Why not VerbList?
	})
	if err != nil {
		return nil, fmt.Errorf("failed to compile checker: %w", err)
	}

	secureValuesMetadata, err := s.secureValueMetadataStorage.List(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("fetching secure values from storage: %+w", err)
	}

	out := make([]secretv0alpha1.SecureValue, 0)

	for _, metadata := range secureValuesMetadata {
		// Check whether the user has permission to access this specific SecureValue in the namespace.
		if !hasPermissionFor(metadata.Name, "") {
			continue
		}

		out = append(out, metadata)
	}

	return &secretv0alpha1.SecureValueList{
		Items: out,
	}, nil
}

func (s *SecureValueService) Delete(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Delete", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	sv, err := s.secureValueMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{ForUpdate: true})
	if err != nil {
		return nil, fmt.Errorf("fetching secure value: %+w", err)
	}

	if err := s.secureValueMetadataStorage.SetVersionToInactive(ctx, namespace, name, sv.Status.Version); err != nil {
		return nil, fmt.Errorf("setting secure value version to inactive: %+w", err)
	}

	return sv, nil
}
