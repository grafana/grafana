package resourcepermission

import (
	"context"
	"fmt"
	"slices"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/authlib/types"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type Mapper interface {
	ActionSets() []string
	Scope(name string) string
	ActionSet(level string) (string, error)
	ScopePattern() string
}

// ResourceNameResolver translates between external names (UIDs used in the K8s API)
// and internal names (e.g. numeric IDs used in legacy SQL scopes) for resource types
// where the scope attribute differs from the API identifier.
type ResourceNameResolver interface {
	// ExternalToInternal converts an API-level name (e.g. SA UID) to the internal
	// scope name (e.g. numeric ID string) used in RBAC permission rows.
	ExternalToInternal(ctx context.Context, ns types.NamespaceInfo, externalName string) (string, error)
	// InternalToExternal converts an internal scope name (e.g. numeric ID string)
	// to the API-level name (e.g. SA UID) returned in K8s objects.
	InternalToExternal(ctx context.Context, ns types.NamespaceInfo, internalName string) (string, error)
}

// APIServiceAccountNameResolver resolves service account UIDs ↔ internal numeric IDs
// by querying the K8s ServiceAccount API via a dynamic client. This is mode-agnostic:
// it works regardless of whether service accounts are stored in legacy SQL or unified storage,
// because the K8s apiserver handles routing internally and always stores the legacy numeric ID
// in the grafana.app/deprecatedInternalID label.
type APIServiceAccountNameResolver struct {
	configProvider func(ctx context.Context) (*rest.Config, error)
}

func NewAPIServiceAccountNameResolver(configProvider func(ctx context.Context) (*rest.Config, error)) ResourceNameResolver {
	return &APIServiceAccountNameResolver{configProvider: configProvider}
}

// ExternalToInternal resolves a service account UID to its legacy numeric ID by
// fetching the SA from the K8s API and reading the grafana.app/deprecatedInternalID label.
func (r *APIServiceAccountNameResolver) ExternalToInternal(ctx context.Context, ns types.NamespaceInfo, uid string) (string, error) {
	client, err := r.saClient(ctx, ns.Value)
	if err != nil {
		return "", fmt.Errorf("create service account client: %w", err)
	}
	obj, err := client.Get(ctx, uid, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("get service account %q: %w", uid, err)
	}
	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return "", fmt.Errorf("meta accessor for service account %q: %w", uid, err)
	}
	id := accessor.GetDeprecatedInternalID()
	if id == 0 {
		return "", fmt.Errorf("service account %q has no deprecated internal ID", uid)
	}
	return fmt.Sprintf("%d", id), nil
}

// InternalToExternal resolves a legacy numeric ID to a service account UID by listing
// SAs with the grafana.app/deprecatedInternalID label selector.
func (r *APIServiceAccountNameResolver) InternalToExternal(ctx context.Context, ns types.NamespaceInfo, id string) (string, error) {
	client, err := r.saClient(ctx, ns.Value)
	if err != nil {
		return "", fmt.Errorf("create service account client: %w", err)
	}
	list, err := client.List(ctx, metav1.ListOptions{
		LabelSelector: utils.LabelKeyDeprecatedInternalID + "=" + id,
		Limit:         1,
	})
	if err != nil {
		return "", fmt.Errorf("list service accounts with internal ID %s: %w", id, err)
	}
	if len(list.Items) == 0 {
		return "", fmt.Errorf("service account with internal ID %s not found", id)
	}
	return list.Items[0].GetName(), nil
}

func (r *APIServiceAccountNameResolver) saClient(ctx context.Context, namespace string) (dynamic.ResourceInterface, error) {
	cfg, err := r.configProvider(ctx)
	if err != nil {
		return nil, err
	}
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}
	return client.Resource(v0alpha1.ServiceAccountResourceInfo.GroupVersionResource()).Namespace(namespace), nil
}

type mapper struct {
	resource   string
	attribute  string // "uid" or "id"
	actionSets []string
}

func NewMapper(resource string, levels []string) Mapper {
	return NewMapperWithAttribute(resource, levels, "uid")
}

func NewMapperWithAttribute(resource string, levels []string, attribute string) Mapper {
	sets := make([]string, 0, len(levels))
	for _, level := range levels {
		sets = append(sets, resource+":"+level)
	}
	return mapper{
		resource:   resource,
		attribute:  attribute,
		actionSets: sets,
	}
}

func (m mapper) ActionSets() []string {
	return m.actionSets
}

func (m mapper) Scope(name string) string {
	return m.resource + ":" + m.attribute + ":" + name
}

func (m mapper) ActionSet(level string) (string, error) {
	actionSet := m.resource + ":" + strings.ToLower(level)
	if !slices.Contains(m.actionSets, actionSet) {
		return "", fmt.Errorf("invalid level (%s): %w", level, errInvalidSpec)
	}
	return actionSet, nil
}

func (m mapper) ScopePattern() string {
	return m.resource + ":" + m.attribute + ":%"
}
