package reststorage

import (
	"context"
	"errors"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

var (
	_ rest.Scoper               = (*AuditLogConfigRest)(nil)
	_ rest.SingularNameProvider = (*AuditLogConfigRest)(nil)
	_ rest.Getter               = (*AuditLogConfigRest)(nil)
	_ rest.Lister               = (*AuditLogConfigRest)(nil)
	_ rest.Storage              = (*AuditLogConfigRest)(nil)
	_ rest.Creater              = (*AuditLogConfigRest)(nil)
	_ rest.Updater              = (*AuditLogConfigRest)(nil)
	_ rest.GracefulDeleter      = (*AuditLogConfigRest)(nil)
)

type AuditLogConfigRest struct {
	storage            contracts.AuditLogConfigStorage
	database           contracts.Database
	accessClient       claims.AccessClient
	resource           utils.ResourceInfo
	tableConverter     rest.TableConvertor
	tracer             trace.Tracer
	secureValueService contracts.SecureValueService
}

func NewAuditLogConfigRest(tracer trace.Tracer, database contracts.Database, storage contracts.AuditLogConfigStorage, accessClient claims.AccessClient, resource utils.ResourceInfo, secureValueService contracts.SecureValueService) *AuditLogConfigRest {
	return &AuditLogConfigRest{storage, database, accessClient, resource, resource.TableConverter(), tracer, secureValueService}
}

func (s *AuditLogConfigRest) New() runtime.Object { return s.resource.NewFunc() }

func (s *AuditLogConfigRest) Destroy() {}

func (s *AuditLogConfigRest) NamespaceScoped() bool { return true }

func (s *AuditLogConfigRest) GetSingularName() string { return s.resource.GetSingularName() }

func (s *AuditLogConfigRest) NewList() runtime.Object { return s.resource.NewListFunc() }

func (s *AuditLogConfigRest) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *AuditLogConfigRest) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	ctx, span := s.tracer.Start(ctx, "AuditLogConfigRest.List", trace.WithAttributes(attribute.String("namespace", namespace)))
	defer span.End()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	hasPermissionFor, err := s.accessClient.Compile(ctx, user, claims.ListRequest{
		Group:     secretv0alpha1.GROUP,
		Resource:  secretv0alpha1.AuditLogConfigResourceInfo.GetName(),
		Namespace: namespace,
		Verb:      utils.VerbGet,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to compile checker: %w", err)
	}

	labelSelector := options.LabelSelector
	if labelSelector == nil {
		labelSelector = labels.Everything()
	}

	auditLogConfigList, err := s.storage.List(ctx, xkube.Namespace(namespace))
	if err != nil {
		return nil, fmt.Errorf("failed to list audit log config: %w", err)
	}

	allowedAuditLogConfigs := make([]secretv0alpha1.AuditLogConfig, 0)

	for _, auditLogConfig := range auditLogConfigList {
		// Check whether the user has permission to access this specific AuditLogConfig in the namespace.
		if !hasPermissionFor(auditLogConfig.Name, "") {
			continue
		}

		if labelSelector.Matches(labels.Set(auditLogConfig.Labels)) {
			allowedAuditLogConfigs = append(allowedAuditLogConfigs, auditLogConfig)
		}
	}

	return &secretv0alpha1.AuditLogConfigList{
		Items: allowedAuditLogConfigs,
	}, nil
}

func (s *AuditLogConfigRest) Get(ctx context.Context, _ string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	ctx, span := s.tracer.Start(ctx, "AuditLogConfigRest.Get", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	cfg, err := s.storage.Read(ctx, xkube.Namespace(namespace))
	if err != nil {
		if errors.Is(err, contracts.ErrAuditLogConfigNotFound) {
			return nil, apierrors.NewNotFound(secretv0alpha1.AuditLogConfigResourceInfo.GroupResource(), namespace)
		}

		return nil, fmt.Errorf("failed to read audit log config: %w", err)
	}

	return cfg, nil
}

func (s *AuditLogConfigRest) Create(ctx context.Context, obj runtime.Object, vFunc rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	cfg, ok := obj.(*secretv0alpha1.AuditLogConfig)
	if !ok {
		return nil, fmt.Errorf("expected AuditLogConfig for create")
	}

	ctx, span := s.tracer.Start(ctx, "AuditLogConfigRest.Create", trace.WithAttributes(
		attribute.String("name", cfg.GetName()),
		attribute.String("namespace", cfg.GetNamespace()),
	))
	defer span.End()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	if err := vFunc(ctx, obj); err != nil {
		return nil, err
	}

	var createdAuditLogConfig *secretv0alpha1.AuditLogConfig
	err := s.database.Transaction(ctx, func(ctx context.Context) error {
		if cfg.Spec.LokiLogger != nil && cfg.Spec.LokiLogger.URL.Value != "" {
			svSpec := &secretv0alpha1.SecureValue{
				TypeMeta:   cfg.TypeMeta,
				ObjectMeta: cfg.ObjectMeta,
				Spec: secretv0alpha1.SecureValueSpec{
					Description: "blabla",
					Value:       cfg.Spec.LokiLogger.URL.Value,
					Decrypters:  []string{contracts.SecretAuditLogServiceIdentity},
				},
			}
			svSpec.SetName("secret-audit-log-loki-url-" + cfg.GetNamespace())

			sv, err := s.secureValueService.Create(ctx, svSpec, user.GetUID())
			if err != nil {
				return err
			}

			cfg.Spec.LokiLogger.URL.SecureValueName = sv.Name
			cfg.Spec.LokiLogger.URL.Value = ""
		}

		var errc error
		createdAuditLogConfig, errc = s.storage.Create(ctx, cfg, user.GetUID())
		if errc != nil {
			var kErr xkube.ErrorLister
			if errors.As(errc, &kErr) {
				return apierrors.NewInvalid(cfg.GroupVersionKind().GroupKind(), cfg.Name, kErr.ErrorList())
			}

			return fmt.Errorf("failed to create audit log config: %w", errc)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create audit log config: %w", err)
	}

	return createdAuditLogConfig, nil
}

func (s *AuditLogConfigRest) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	ctx, span := s.tracer.Start(ctx, "AuditLogConfigRest.Update", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", request.NamespaceValue(ctx)),
	))
	defer span.End()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, false, fmt.Errorf("missing auth info in context")
	}

	oldObj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, fmt.Errorf("k8s updated object: %w", err)
	}

	if err := updateValidation(ctx, newObj, oldObj); err != nil {
		return nil, false, err
	}

	newAuditLogConfig, ok := newObj.(*secretv0alpha1.AuditLogConfig)
	if !ok {
		return nil, false, fmt.Errorf("expected AuditLogConfig for update")
	}

	updatedAuditLogConfig, err := s.storage.Update(ctx, newAuditLogConfig, user.GetUID())
	if err != nil {
		var kErr xkube.ErrorLister
		if errors.As(err, &kErr) {
			return nil, false, apierrors.NewInvalid(newAuditLogConfig.GroupVersionKind().GroupKind(), newAuditLogConfig.Name, kErr.ErrorList())
		}

		return nil, false, fmt.Errorf("failed to update audit log config: %w", err)
	}

	return updatedAuditLogConfig, false, nil
}

func (s *AuditLogConfigRest) Delete(ctx context.Context, _ string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, false, fmt.Errorf("missing namespace")
	}

	ctx, span := s.tracer.Start(ctx, "AuditLogConfigRest.Delete", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	err := s.storage.Delete(ctx, xkube.Namespace(namespace))
	if err != nil {
		return nil, false, fmt.Errorf("failed to delete audit log config: %w", err)
	}

	return nil, true, nil
}
