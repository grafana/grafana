package service

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apiserver/pkg/admission"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service/metrics"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
)

var _ contracts.SecureValueService = (*SecureValueService)(nil)

type SecureValueService struct {
	tracer                     trace.Tracer
	accessClient               claims.AccessClient
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	secureValueValidator       contracts.SecureValueValidator
	secureValueMutator         contracts.SecureValueMutator
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	keeperService              contracts.KeeperService
	metrics                    *metrics.SecureValueServiceMetrics
}

func ProvideSecureValueService(
	tracer trace.Tracer,
	accessClient claims.AccessClient,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	secureValueValidator contracts.SecureValueValidator,
	secureValueMutator contracts.SecureValueMutator,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService contracts.KeeperService,
	reg prometheus.Registerer,
) contracts.SecureValueService {
	s := &SecureValueService{
		tracer:                     tracer,
		accessClient:               accessClient,
		secureValueMetadataStorage: secureValueMetadataStorage,
		secureValueValidator:       secureValueValidator,
		secureValueMutator:         secureValueMutator,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService,
		metrics:                    metrics.NewSecureValueServiceMetrics(reg),
	}

	// // SeedSecureValues can be called to populate the database for testing, e.g.:
	// //   SeedSecureValues(ctx, s, 1000, 20)
	// err := SeedSecureValues(context.Background(), s, 1000, 100)
	// if err != nil {
	// 	panic(err)
	// }

	return s
}

const (
	seedActorUID = "seed-actor"
)

// randString returns a string of length n from the given charset.
func randString(charset string, n int, rng *rand.Rand) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = charset[rng.Intn(len(charset))]
	}
	return string(b)
}

// SeedSecureValues creates random namespaces and secrets by calling Create on the service.
// Useful for testing or load testing. Each namespace gets an active keeper implicitly (system keeper).
func SeedSecureValues(ctx context.Context, svc contracts.SecureValueService, numberOfNamespaces, maxSecretsPerNamespace int) error {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	nsChars := "abcdefghijklmnopqrstuvwxyz0123456789"
	// Description: 1–25 chars; keep short for readability
	descLen := 10
	// Value: 1–24576 bytes; use small values for seeding
	valueLen := 24

	for i := 0; i < numberOfNamespaces; i++ {
		namespace := "ns-" + randString(nsChars, 12, rng)
		nSecrets := maxSecretsPerNamespace
		if nSecrets < 1 {
			nSecrets = 1
		}
		nSecrets = rng.Intn(nSecrets) + 1 // [1, maxSecretsPerNamespace] per namespace
		for j := 0; j < nSecrets; j++ {
			name := "sv-" + randString(nsChars, 8, rng)
			description := randString(nsChars, descLen, rng)
			value := randString(nsChars, valueLen, rng)
			sv := &secretv1beta1.SecureValue{
				ObjectMeta: metav1.ObjectMeta{
					Name:      name,
					Namespace: namespace,
				},
				Spec: secretv1beta1.SecureValueSpec{
					Description: description,
					Value:       ptr.To(secretv1beta1.NewExposedSecureValue(value)),
					Decrypters:  []string{"decrypter1"},
				},
				Status: secretv1beta1.SecureValueStatus{},
			}
			_, err := svc.Create(ctx, sv, seedActorUID)
			if err != nil {
				return fmt.Errorf("create secure value namespace=%s name=%s: %w", namespace, name, err)
			}
		}
	}
	return nil
}

func (s *SecureValueService) Create(ctx context.Context, sv *secretv1beta1.SecureValue, actorUID string) (createdSv *secretv1beta1.SecureValue, createErr error) {
	start := time.Now()

	ctx, span := s.tracer.Start(ctx, "SecureValueService.Create", trace.WithAttributes(
		attribute.String("namespace", sv.GetNamespace()),
		attribute.String("actor", actorUID),
	))
	defer span.End()

	defer func() {
		args := []any{
			"namespace", sv.GetNamespace(),
			"actorUID", actorUID,
		}

		if createdSv != nil {
			args = append(args, "name", createdSv.GetName())
			span.SetAttributes(attribute.String("name", createdSv.GetName()))
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
	}()

	// Secure value creation uses the active keeper
	keeperName, keeperCfg, err := s.keeperMetadataStorage.GetActiveKeeperConfig(ctx, sv.Namespace)
	if err != nil {
		return nil, fmt.Errorf("fetching active keeper config: namespace=%+v %w", sv.Namespace, err)
	}

	return s.createNewVersion(ctx, keeperName, keeperCfg, sv, actorUID)
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
	}()

	currentVersion, err := s.secureValueMetadataStorage.Read(ctx, xkube.Namespace(newSecureValue.Namespace), newSecureValue.Name, contracts.ReadOpts{})
	if err != nil {
		return nil, false, fmt.Errorf("reading secure value secret: %+w", err)
	}

	keeperCfg, err := s.keeperMetadataStorage.GetKeeperConfig(ctx, currentVersion.Namespace, currentVersion.Status.Keeper, contracts.ReadOpts{})
	if err != nil {
		return nil, false, fmt.Errorf("fetching keeper config: namespace=%+v keeper: %q %w", newSecureValue.Namespace, currentVersion.Status.Keeper, err)
	}

	if newSecureValue.Spec.Value == nil && newSecureValue.Spec.Ref == nil {
		keeper, err := s.keeperService.KeeperForConfig(keeperCfg)
		if err != nil {
			return nil, false, fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", newSecureValue.Namespace, newSecureValue.Status.Keeper, err)
		}
		logging.FromContext(ctx).Debug("retrieved keeper", "namespace", newSecureValue.Namespace, "type", keeperCfg.Type())

		secret, err := keeper.Expose(ctx, keeperCfg, xkube.Namespace(newSecureValue.Namespace), newSecureValue.Name, currentVersion.Status.Version)
		if err != nil {
			return nil, false, fmt.Errorf("reading secret value from keeper: %w %w", contracts.ErrSecureValueMissingSecretAndRef, err)
		}

		newSecureValue.Spec.Value = &secret
	}

	// Secure value updates use the keeper used to create the secure value
	const updateIsSync = true
	createdSv, err := s.createNewVersion(ctx, currentVersion.Status.Keeper, keeperCfg, newSecureValue, actorUID)
	return createdSv, updateIsSync, err
}

func (s *SecureValueService) createNewVersion(ctx context.Context, keeperName string, keeperCfg secretv1beta1.KeeperConfig, sv *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, error) {
	if keeperName == "" {
		return nil, fmt.Errorf("keeper name is required, got empty string")
	}
	if err := s.secureValueMutator.Mutate(sv, admission.Create); err != nil {
		return nil, err
	}

	if errorList := s.secureValueValidator.Validate(sv, nil, admission.Create); len(errorList) > 0 {
		return nil, contracts.NewErrValidateSecureValue(errorList)
	}

	if sv.Spec.Ref != nil && keeperCfg.Type() == secretv1beta1.SystemKeeperType {
		return nil, contracts.ErrReferenceWithSystemKeeper
	}

	createdSv, err := s.secureValueMetadataStorage.Create(ctx, keeperName, sv, actorUID)
	if err != nil {
		return nil, fmt.Errorf("creating secure value: %w", err)
	}

	createdSv.Status = secretv1beta1.SecureValueStatus{
		Version: createdSv.Status.Version,
		Keeper:  keeperName,
	}

	keeper, err := s.keeperService.KeeperForConfig(keeperCfg)
	if err != nil {
		return nil, fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", createdSv.Namespace, keeperName, err)
	}
	logging.FromContext(ctx).Debug("retrieved keeper", "namespace", createdSv.Namespace, "type", keeperCfg.Type())
	// TODO: can we stop using external id?
	// TODO: store uses only the namespace and returns and id. It could be a kv instead.
	// TODO: check that the encrypted store works with multiple versions
	switch {
	case sv.Spec.Value != nil:
		externalID, err := keeper.Store(ctx, keeperCfg, xkube.Namespace(createdSv.Namespace), createdSv.Name, createdSv.Status.Version, sv.Spec.Value.DangerouslyExposeAndConsumeValue())
		if err != nil {
			return nil, fmt.Errorf("storing secure value in keeper: %w", err)
		}
		createdSv.Status.ExternalID = string(externalID)

		if err := s.secureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace(createdSv.Namespace), createdSv.Name, createdSv.Status.Version, externalID); err != nil {
			return nil, fmt.Errorf("setting secure value external id: %w", err)
		}

	case sv.Spec.Ref != nil:
		// No-op, there's nothing to store in the keeper since the
		// secret is already stored in the 3rd party secret store
		// and it's being referenced.

	default:
		return nil, fmt.Errorf("secure value doesn't specify either a secret value or a reference")
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
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}
	if name == "" {
		return nil, fmt.Errorf("name cannot be empty")
	}

	start := time.Now()

	ctx, span := s.tracer.Start(ctx, "SecureValueService.Read", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))

	defer func() {
		args := []any{
			"name", name,
			"namespace", namespace.String(),
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
	}()

	defer span.End()

	return s.secureValueMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{ForUpdate: false})
}

func (s *SecureValueService) List(ctx context.Context, namespace xkube.Namespace) (_ *secretv1beta1.SecureValueList, listErr error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}

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
	}()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	hasPermissionFor, _, err := s.accessClient.Compile(ctx, user, claims.ListRequest{
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
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}
	if name == "" {
		return nil, fmt.Errorf("name cannot be empty")
	}

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

func (s *SecureValueService) SetKeeperAsActive(ctx context.Context, namespace xkube.Namespace, name string) error {
	// The system keeper is not in the database, so skip checking it exists.
	// TODO: should the system keeper be in the database?
	if name != contracts.SystemKeeperName {
		// Check keeper exists. No need to worry about time of check to time of use
		// since trying to activate a just deleted keeper will result in all
		// keepers being inactive and defaulting to the system keeper.
		if _, err := s.keeperMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{}); err != nil {
			return fmt.Errorf("reading keeper before setting as active: %w", err)
		}
	}
	if err := s.keeperMetadataStorage.SetAsActive(ctx, namespace, name); err != nil {
		return fmt.Errorf("calling keeper metadata storage to set keeper as active: %w", err)
	}
	return nil
}
