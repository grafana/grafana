package service

import (
	"context"
	"fmt"
	"strconv"
	"time"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service/metrics"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/codes"
)

var _ contracts.SecureValueService = (*SecureValueService)(nil)

type SecureValueService struct {
	tracer                     trace.Tracer
	accessClient               claims.AccessClient
	database                   contracts.Database
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	keeperService              contracts.KeeperService
	metrics                    *metrics.SecureValueServiceMetrics
}

func ProvideSecureValueService(
	tracer trace.Tracer,
	accessClient claims.AccessClient,
	database contracts.Database,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService contracts.KeeperService,
	reg prometheus.Registerer,
) contracts.SecureValueService {
	return &SecureValueService{
		tracer:                     tracer,
		accessClient:               accessClient,
		database:                   database,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService,
		metrics:                    metrics.NewSecureValueServiceMetrics(reg),
	}
}

func (s *SecureValueService) Create(ctx context.Context, sv *secretv1beta1.SecureValue, actorUID string) (_ *secretv1beta1.SecureValue, createErr error) {
	start := time.Now()
	name, namespace := sv.GetName(), sv.GetNamespace()
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Create", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace),
		attribute.String("actor", actorUID),
	))
	defer span.End()

	defer func() {
		args := []any{
			"name", name,
			"namespace", namespace,
			"actorUID", actorUID,
		}

		success := createErr == nil
		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "SecureValueService.Create failed")
			span.RecordError(createErr)
			args = append(args, "error", createErr)
		}

		logging.FromContext(ctx).Info("SecureValueService.Create finished", args...)

		s.metrics.SecureValueCreateDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
		s.metrics.SecureValueCreateCount.WithLabelValues(strconv.FormatBool(success)).Inc()
	}()

	return s.createNewVersion(ctx, sv, actorUID)
}

func (s *SecureValueService) Update(ctx context.Context, newSecureValue *secretv1beta1.SecureValue, actorUID string) (_ *secretv1beta1.SecureValue, sync bool, updateErr error) {
	start := time.Now()
	name, namespace := newSecureValue.GetName(), newSecureValue.GetNamespace()

	ctx, span := s.tracer.Start(ctx, "SecureValueService.Update", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace),
		attribute.String("actor", actorUID),
	))
	defer span.End()

	defer func() {
		args := []any{
			"name", name,
			"namespace", namespace,
			"actorUID", actorUID,
			"sync", sync,
		}

		success := updateErr == nil
		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "SecureValueService.Update failed")
			span.RecordError(updateErr)
			args = append(args, "error", updateErr)
		}

		logging.FromContext(ctx).Info("SecureValueService.Update finished", args...)

		s.metrics.SecureValueUpdateDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
		s.metrics.SecureValueUpdateCount.WithLabelValues(strconv.FormatBool(success)).Inc()
	}()

	if newSecureValue.Spec.Value == nil {
		currentVersion, err := s.secureValueMetadataStorage.Read(ctx, xkube.Namespace(newSecureValue.Namespace), newSecureValue.Name, contracts.ReadOpts{})
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

		secret, err := keeper.Expose(ctx, keeperCfg, newSecureValue.Namespace, newSecureValue.Name, currentVersion.Status.Version)
		if err != nil {
			return nil, false, fmt.Errorf("reading secret value from keeper: %w", err)
		}

		newSecureValue.Spec.Value = &secret
	}

	const updateIsSync = true
	createdSv, err := s.createNewVersion(ctx, newSecureValue, actorUID)
	return createdSv, updateIsSync, err
}

func (s *SecureValueService) createNewVersion(ctx context.Context, sv *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, error) {
	createdSv, err := s.secureValueMetadataStorage.Create(ctx, sv, actorUID)
	if err != nil {
		return nil, fmt.Errorf("creating secure value: %w", err)
	}
	createdSv.Status = secretv1beta1.SecureValueStatus{
		Version: createdSv.Status.Version,
	}

	// TODO: does this need to be for update?
	keeperCfg, err := s.keeperMetadataStorage.GetKeeperConfig(ctx, createdSv.Namespace, createdSv.Spec.Keeper, contracts.ReadOpts{ForUpdate: true})
	if err != nil {
		return nil, fmt.Errorf("fetching keeper config: namespace=%+v keeperName=%+v %w", createdSv.Namespace, createdSv.Spec.Keeper, err)
	}

	keeper, err := s.keeperService.KeeperForConfig(keeperCfg)
	if err != nil {
		return nil, fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", createdSv.Namespace, createdSv.Spec.Keeper, err)
	}
	logging.FromContext(ctx).Debug("retrieved keeper", "namespace", createdSv.Namespace, "keeperName", createdSv.Spec.Keeper, "type", keeperCfg.Type())

	// TODO: can we stop using external id?
	// TODO: store uses only the namespace and returns and id. It could be a kv instead.
	// TODO: check that the encrypted store works with multiple versions
	externalID, err := keeper.Store(ctx, keeperCfg, createdSv.Namespace, createdSv.Name, createdSv.Status.Version, sv.Spec.Value.DangerouslyExposeAndConsumeValue())
	if err != nil {
		return nil, fmt.Errorf("storing secure value in keeper: %w", err)
	}
	createdSv.Status.ExternalID = string(externalID)

	if err := s.secureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace(createdSv.Namespace), createdSv.Name, createdSv.Status.Version, externalID); err != nil {
		return nil, fmt.Errorf("setting secure value external id: %w", err)
	}

	if err := s.secureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace(createdSv.Namespace), createdSv.Name, createdSv.Status.Version); err != nil {
		return nil, fmt.Errorf("marking secure value version as active: %w", err)
	}

	// In a single query:
	// TODO: set external id
	// TODO: set to active

	return createdSv, nil
}

func (s *SecureValueService) Read(ctx context.Context, namespace xkube.Namespace, name string) (_ *secretv1beta1.SecureValue, readErr error) {
	start := time.Now()

	ctx, span := s.tracer.Start(ctx, "SecureValueService.Read", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))

	defer func() {
		args := []any{
			"name", name,
			"namespace", namespace,
		}

		success := readErr == nil
		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "SecureValueService.Read failed")
			span.RecordError(readErr)
			args = append(args, "error", readErr)
		}

		logging.FromContext(ctx).Info("SecureValueService.Read finished", args...)

		s.metrics.SecureValueReadDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
		s.metrics.SecureValueReadCount.WithLabelValues(strconv.FormatBool(success)).Inc()
	}()

	defer span.End()

	return s.secureValueMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{ForUpdate: false})
}

func (s *SecureValueService) List(ctx context.Context, namespace xkube.Namespace) (_ *secretv1beta1.SecureValueList, listErr error) {
	start := time.Now()

	ctx, span := s.tracer.Start(ctx, "SecureValueService.List", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		args := []any{
			"namespace", namespace,
		}

		success := listErr == nil
		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "SecureValueService.List failed")
			span.RecordError(listErr)
			args = append(args, "error", listErr)
		}

		logging.FromContext(ctx).Info("SecureValueService.List finished", args...)

		s.metrics.SecureValueListDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
		s.metrics.SecureValueListCount.WithLabelValues(strconv.FormatBool(success)).Inc()
	}()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	hasPermissionFor, err := s.accessClient.Compile(ctx, user, claims.ListRequest{
		Group:     secretv1beta1.APIGroup,
		Resource:  secretv1beta1.SecureValuesResourceInfo.GetName(),
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

	out := make([]secretv1beta1.SecureValue, 0)

	for _, metadata := range secureValuesMetadata {
		// Check whether the user has permission to access this specific SecureValue in the namespace.
		if !hasPermissionFor(metadata.Name, "") {
			continue
		}

		out = append(out, metadata)
	}

	return &secretv1beta1.SecureValueList{
		Items: out,
	}, nil
}

func (s *SecureValueService) Delete(ctx context.Context, namespace xkube.Namespace, name string) (_ *secretv1beta1.SecureValue, deleteErr error) {
	start := time.Now()

	ctx, span := s.tracer.Start(ctx, "SecureValueService.Delete", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		args := []any{
			"name", name,
			"namespace", namespace,
		}

		success := deleteErr == nil
		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "SecureValueService.Delete failed")
			span.RecordError(deleteErr)
			args = append(args, "error", deleteErr)
		}

		logging.FromContext(ctx).Info("SecureValueService.Delete finished", args...)

		s.metrics.SecureValueDeleteDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
		s.metrics.SecureValueDeleteCount.WithLabelValues(strconv.FormatBool(success)).Inc()
	}()

	// TODO: does this need to be for update?
	sv, err := s.secureValueMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{ForUpdate: true})
	if err != nil {
		return nil, fmt.Errorf("fetching secure value: %+w", err)
	}

	if err := s.secureValueMetadataStorage.SetVersionToInactive(ctx, namespace, name, sv.Status.Version); err != nil {
		return nil, fmt.Errorf("setting secure value version to inactive: %+w", err)
	}

	return sv, nil
}
