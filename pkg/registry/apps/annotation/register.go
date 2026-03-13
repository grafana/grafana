package annotation

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"strconv"
	"strings"

	authtypes "github.com/grafana/authlib/types"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/annotation/pkg/apis"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	annotationapp "github.com/grafana/grafana/apps/annotation/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apiserverrest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	grafrequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg        *setting.Cfg
	k8sAdapter *k8sRESTAdapter
}

// RegisterAppInstaller Layers (from bottom to top):
//  1. annotations.Repository - old Grafana annotation service
//  2. sqlAdapter - Bridges annotations.Repository → Store interface (apps/annotation/Store), converts ItemDTO ↔ v0alpha1.Annotation
//  3. k8sRESTAdapter - Bridges Store → K8s REST interface, handles K8s API conventions
func RegisterAppInstaller(
	cfg *setting.Cfg,
	service annotations.Repository,
	cleaner annotations.Cleaner,
	accessClient authtypes.AccessClient,
) (*AppInstaller, error) {
	installer := &AppInstaller{
		cfg: cfg,
	}

	mapper := grafrequest.GetNamespaceMapper(cfg)

	// Choose storage backend based on configuration
	var store Store
	var err error
	switch cfg.AnnotationAppPlatform.StoreBackend {
	case "grpc":
		store, err = newGRPCStore(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to create gRPC store: %w", err)
		}
	case "sql":
		// sql is the default, but we allow explicitly specifying it for clarity
		fallthrough
	default:
		// Layer 1→2: Wrap old annotations.Repository with sqlAdapter (implements Store interface)
		store = NewSQLAdapter(service, cleaner, mapper, cfg)
	}

	// Layer 2→3: Wrap Store interface with K8s REST adapter
	installer.k8sAdapter = &k8sRESTAdapter{
		store:        store,
		mapper:       mapper,
		accessClient: accessClient,
	}

	// Create the tags handler
	tagProvider, ok := store.(TagProvider)
	if !ok {
		// We could consider combining the TagProvider with the Store interface to avoid this type assertion?
		return nil, fmt.Errorf("store does not implement TagProvider, cannot serve tags API")
	}
	tagHandler := newTagsHandler(tagProvider)

	// Create the search handler
	searchHandler := newSearchHandler(store, accessClient)

	provider := simple.NewAppProvider(apis.LocalManifest(), nil, annotationapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{},
		ManifestData: *apis.LocalManifest().ManifestData,
		SpecificConfig: &annotationapp.AnnotationConfig{
			TagHandler:    tagHandler,
			SearchHandler: searchHandler,
		},
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

func newGRPCStore(cfg *setting.Cfg) (Store, error) {
	var dialOpts []grpc.DialOption
	if cfg.AnnotationAppPlatform.GRPCUseTLS {
		tlsConfig, err := loadTLSConfig(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to load TLS config: %w", err)
		}
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
	} else {
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	grpcConn, err := grpc.NewClient(
		cfg.AnnotationAppPlatform.GRPCAddress,
		dialOpts...,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to annotation gRPC server at %s: %w",
			cfg.AnnotationAppPlatform.GRPCAddress, err)
	}
	return NewStoreGRPC(grpcConn), nil
}

func loadTLSConfig(cfg *setting.Cfg) (*tls.Config, error) {
	tlsConfig := &tls.Config{}
	if cfg.AnnotationAppPlatform.GRPCTLSCAFile != "" {
		caCert, err := os.ReadFile(cfg.AnnotationAppPlatform.GRPCTLSCAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA file: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to append CA certificate")
		}
		tlsConfig.RootCAs = caCertPool
	}

	if cfg.AnnotationAppPlatform.GRPCTLSSkipVerify {
		tlsConfig.InsecureSkipVerify = true
	}

	return tlsConfig, nil
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// Allow all authenticated users; fine-grained authz is handled per-operation in k8sRESTAdapter.
		return authorizer.DecisionAllow, "", nil
	})
}

// GetLegacyStorage returns the K8s REST storage implementation for the annotation resource.
// Called by the app platform to get the storage backend.
func (a *AppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) apiserverrest.Storage {
	kind := annotationV0.AnnotationKind()
	gvr := schema.GroupVersionResource{
		Group:    kind.Group(),
		Version:  kind.Version(),
		Resource: kind.Plural(),
	}

	if requested.String() != gvr.String() {
		return nil
	}

	// Set up table converter for kubectl-style output
	a.k8sAdapter.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Text", Type: "string", Format: "name"},
			},
			Reader: func(obj any) ([]any, error) {
				m, ok := obj.(*annotationV0.Annotation)
				if !ok {
					return nil, fmt.Errorf("expected Annotation")
				}
				return []any{
					m.Spec.Text,
				}, nil
			},
		},
	)

	return a.k8sAdapter
}

var (
	_ rest.Scoper               = (*k8sRESTAdapter)(nil)
	_ rest.SingularNameProvider = (*k8sRESTAdapter)(nil)
	_ rest.Getter               = (*k8sRESTAdapter)(nil)
	_ rest.Storage              = (*k8sRESTAdapter)(nil)
	_ rest.Creater              = (*k8sRESTAdapter)(nil)
	_ rest.Updater              = (*k8sRESTAdapter)(nil)
	_ rest.GracefulDeleter      = (*k8sRESTAdapter)(nil)
)

// k8sRESTAdapter adapts the Store interface to Kubernetes REST storage interface.
// This layer handles K8s API conventions (fieldSelectors, ListOptions, runtime.Object, etc.)
// and delegates actual storage operations to the Store interface.
type k8sRESTAdapter struct {
	store          Store
	mapper         grafrequest.NamespaceMapper
	tableConverter rest.TableConvertor
	accessClient   authtypes.AccessClient
}

func (s *k8sRESTAdapter) New() runtime.Object {
	return annotationV0.AnnotationKind().ZeroValue()
}

func (s *k8sRESTAdapter) Destroy() {}

func (s *k8sRESTAdapter) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *k8sRESTAdapter) GetSingularName() string {
	return strings.ToLower(annotationV0.AnnotationKind().Kind())
}

func (s *k8sRESTAdapter) NewList() runtime.Object {
	return annotationV0.AnnotationKind().ZeroListValue()
}

func (s *k8sRESTAdapter) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *k8sRESTAdapter) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)

	opts := ListOptions{}
	if options.FieldSelector != nil {
		// Parse K8s field selectors into Store ListOptions
		for _, r := range options.FieldSelector.Requirements() {
			switch r.Field {
			case "spec.dashboardUID":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					opts.DashboardUID = r.Value
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.dashboardUID (only = supported)", r.Operator)
				}

			case "spec.panelID":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					panelID, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid panelID value %q: %w", r.Value, err)
					}
					opts.PanelID = panelID
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.panelID (only = supported)", r.Operator)
				}
			case "spec.time":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					from, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid time value %q: %w", r.Value, err)
					}
					opts.From = from
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.from (only = supported)", r.Operator)
				}
			case "spec.timeEnd":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					to, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid timeEnd value %q: %w", r.Value, err)
					}
					opts.To = to
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.to (only = supported)", r.Operator)
				}
			default:
				return nil, fmt.Errorf("unsupported field selector: %s", r.Field)
			}
		}
	}

	opts.Limit = 100
	if options.Limit > 0 {
		opts.Limit = options.Limit
	}

	// Extract continue token from request
	if options.Continue != "" {
		opts.Continue = options.Continue
	}

	result, err := s.store.List(ctx, namespace, opts)
	if err != nil {
		return nil, err
	}

	// TODO: post-fetch filtering breaks pagination - cursor advances by opts.Limit regardless of authz results.
	filtered := make([]annotationV0.Annotation, 0, len(result.Items))
	for _, anno := range result.Items {
		allowed, err := canAccessAnnotation(ctx, s.accessClient, namespace, &anno, utils.VerbList)
		if err != nil {
			return nil, err
		}
		if allowed {
			filtered = append(filtered, anno)
		}
	}

	return &annotationV0.AnnotationList{
		Items:    filtered,
		ListMeta: metav1.ListMeta{Continue: result.Continue},
	}, nil
}

func (s *k8sRESTAdapter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)

	annotation, err := s.store.Get(ctx, namespace, name)
	if err != nil {
		return nil, err
	}

	allowed, err := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbGet)
	if err != nil {
		return nil, err
	}
	if !allowed {
		// Return NotFound to avoid leaking existence.
		return nil, apierrors.NewNotFound(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(), name,
		)
	}

	return annotation, nil
}

func (s *k8sRESTAdapter) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	annotation, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return nil, fmt.Errorf("expected annotation")
	}

	namespace := request.NamespaceValue(ctx)

	allowed, err := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbCreate)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, apierrors.NewForbidden(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
			annotation.Name, fmt.Errorf("insufficient permissions"),
		)
	}

	if annotation.Name == "" && annotation.GenerateName == "" {
		return nil, apierrors.NewBadRequest("metadata.name or metadata.generateName is required")
	}

	if annotation.Name == "" && annotation.GenerateName != "" {
		annotation.Name = annotation.GenerateName + util.GenerateShortUID()
	}

	return s.store.Create(ctx, annotation)
}

func (s *k8sRESTAdapter) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)

	// Fetch the existing annotation for patch merging and to verify authz on the pre-update resource.
	existing, err := s.store.Get(ctx, namespace, name)
	if err != nil {
		return nil, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, existing)
	if err != nil {
		return nil, false, err
	}

	resource, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return nil, false, fmt.Errorf("expected annotation")
	}

	if resource.Name != name {
		return nil, false, fmt.Errorf("name in URL does not match name in body")
	}

	if resource.Namespace != namespace {
		return nil, false, fmt.Errorf("namespace in URL does not match namespace in body")
	}

	// Check authz on both existing and new body: prevents privilege escalation via scope changes.
	allowed, err := canAccessAnnotation(ctx, s.accessClient, namespace, existing, utils.VerbUpdate)
	if err != nil {
		return nil, false, err
	}
	if !allowed {
		return nil, false, apierrors.NewForbidden(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
			existing.Name, fmt.Errorf("insufficient permissions"),
		)
	}
	allowed, err = canAccessAnnotation(ctx, s.accessClient, namespace, resource, utils.VerbUpdate)
	if err != nil {
		return nil, false, err
	}
	if !allowed {
		return nil, false, apierrors.NewForbidden(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
			resource.Name, fmt.Errorf("insufficient permissions"),
		)
	}

	updated, err := s.store.Update(ctx, resource)
	if err != nil {
		return nil, false, err
	}

	return updated, false, nil
}

func (s *k8sRESTAdapter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)

	annotation, err := s.store.Get(ctx, namespace, name)
	if err != nil {
		return nil, false, err
	}

	allowedDelete, err := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbDelete)
	if err != nil {
		return nil, false, err
	}
	if !allowedDelete {
		// Return 404 if caller can't read (don't leak existence), 403 if readable but not deletable.
		allowedRead, err := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbGet)
		if err != nil {
			return nil, false, err
		}
		if !allowedRead {
			return nil, false, apierrors.NewNotFound(
				annotationV0.AnnotationKind().GroupVersionResource().GroupResource(), name,
			)
		}
		return nil, false, apierrors.NewForbidden(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
			name, fmt.Errorf("insufficient permissions"),
		)
	}

	err = s.store.Delete(ctx, namespace, name)
	return nil, false, err
}

func (s *k8sRESTAdapter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for annotation is not available")
}

// canAccessAnnotation checks that the caller has permission to perform verb on anno,
// using the legacy annotation authorization model (dashboard-scoped or org-scoped).
func canAccessAnnotation(ctx context.Context, accessClient authtypes.AccessClient, namespace string, anno *annotationV0.Annotation, verb string) (bool, error) {
	if anno == nil {
		return false, apierrors.NewBadRequest("annotation must not be nil")
	}

	authInfo, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return false, apierrors.NewUnauthorized("no identity found for request")
	}

	var checkReq authtypes.CheckRequest

	if anno.Spec.DashboardUID == nil || *anno.Spec.DashboardUID == "" {
		// Org-level annotation: scope is annotations:type:organization.
		checkReq = authtypes.CheckRequest{
			Verb:      verb,
			Group:     "annotation.grafana.app",
			Resource:  "annotations",
			Namespace: namespace,
			Name:      "organization",
		}
	} else {
		// Dashboard annotation: use dashboard.grafana.app/annotations virtual resource,
		// which maps to annotation actions scoped to dashboards:uid:<dashboardUID>.
		checkReq = authtypes.CheckRequest{
			Verb:      verb,
			Group:     "dashboard.grafana.app",
			Resource:  "annotations",
			Namespace: namespace,
			Name:      *anno.Spec.DashboardUID,
		}
	}

	resp, err := accessClient.Check(ctx, authInfo, checkReq, "")
	if err != nil {
		return false, fmt.Errorf("authz check failed: %w", err)
	}

	return resp.Allowed, nil
}
