package apiextensions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// DiscoveryManager manages discovery for dynamically registered custom resources
type DiscoveryManager struct {
	mu        sync.RWMutex
	apiGroups map[string]*metav1.APIGroup        // group name -> APIGroup
	resources map[string]*metav1.APIResourceList // group/version -> APIResourceList
}

// NewDiscoveryManager creates a new discovery manager
func NewDiscoveryManager() *DiscoveryManager {
	return &DiscoveryManager{
		apiGroups: make(map[string]*metav1.APIGroup),
		resources: make(map[string]*metav1.APIResourceList),
	}
}

// AddCustomResource adds a custom resource to the discovery documents
func (d *DiscoveryManager) AddCustomResource(crd *apiextensionsv1.CustomResourceDefinition) {
	d.mu.Lock()
	defer d.mu.Unlock()

	group := crd.Spec.Group
	// TODO(@konsalex): is this needed to be iterated
	// or multiple versions will be different crd entries?
	// Need to test this out
	version := crd.Spec.Versions[0].Name
	gvKey := fmt.Sprintf("%s/%s", group, version)

	// Update API Group discovery
	apiGroup, ok := d.apiGroups[group]
	if !ok {
		apiGroup = &metav1.APIGroup{
			TypeMeta: metav1.TypeMeta{
				Kind:       "APIGroup",
				APIVersion: "v1",
			},
			Name: group,
			Versions: []metav1.GroupVersionForDiscovery{
				{
					GroupVersion: fmt.Sprintf("%s/%s", group, version),
					Version:      version,
				},
			},
			PreferredVersion: metav1.GroupVersionForDiscovery{
				GroupVersion: fmt.Sprintf("%s/%s", group, version),
				Version:      version,
			},
		}
		d.apiGroups[group] = apiGroup
	}

	// Update API Resource List
	resourceList, ok := d.resources[gvKey]
	if !ok {
		resourceList = &metav1.APIResourceList{
			TypeMeta: metav1.TypeMeta{
				Kind:       "APIResourceList",
				APIVersion: "v1",
			},
			GroupVersion: fmt.Sprintf("%s/%s", group, version),
			APIResources: []metav1.APIResource{},
		}
		d.resources[gvKey] = resourceList
	}

	// Add the resource to the list
	apiResource := metav1.APIResource{
		Name:         crd.Spec.Names.Plural,
		SingularName: crd.Spec.Names.Singular,
		Namespaced:   crd.Spec.Scope == apiextensionsv1.NamespaceScoped,
		Kind:         crd.Spec.Names.Kind,
		// TODO(@konsalex): Can this be dynamic ever?
		// Need to validate
		Verbs:      []string{"create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"},
		ShortNames: crd.Spec.Names.ShortNames,
	}

	// Add status subresource if defined
	if crd.Spec.Versions[0].Subresources != nil && crd.Spec.Versions[0].Subresources.Status != nil {
		apiResource.Verbs = append(apiResource.Verbs, "update")
	}

	// Check if resource already exists
	found := false
	for i, r := range resourceList.APIResources {
		if r.Name == apiResource.Name {
			resourceList.APIResources[i] = apiResource
			found = true
			break
		}
	}
	if !found {
		resourceList.APIResources = append(resourceList.APIResources, apiResource)
	}
}

// GetAPIGroupList returns the list of API groups for /apis discovery
func (d *DiscoveryManager) GetAPIGroupList() *metav1.APIGroupList {
	d.mu.RLock()
	defer d.mu.RUnlock()

	groups := make([]metav1.APIGroup, 0, len(d.apiGroups))
	for _, group := range d.apiGroups {
		groups = append(groups, *group)
	}

	return &metav1.APIGroupList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "APIGroupList",
			APIVersion: "v1",
		},
		Groups: groups,
	}
}

// GetAPIGroup returns a specific API group
func (d *DiscoveryManager) GetAPIGroup(name string) *metav1.APIGroup {
	d.mu.RLock()
	defer d.mu.RUnlock()

	return d.apiGroups[name]
}

// GetAPIResourceList returns the resource list for a specific group/version
func (d *DiscoveryManager) GetAPIResourceList(gv schema.GroupVersion) *metav1.APIResourceList {
	d.mu.RLock()
	defer d.mu.RUnlock()

	key := fmt.Sprintf("%s/%s", gv.Group, gv.Version)
	return d.resources[key]
}

// ServeAPIGroup handles requests to /apis/<group>
func (d *DiscoveryManager) ServeAPIGroup(w http.ResponseWriter, req *http.Request, group string) {
	apiGroup := d.GetAPIGroup(group)
	if apiGroup == nil {
		http.NotFound(w, req)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apiGroup)
}

// ServeAPIResourceList handles requests to /apis/<group>/<version>
func (d *DiscoveryManager) ServeAPIResourceList(w http.ResponseWriter, req *http.Request, gv schema.GroupVersion) {
	resourceList := d.GetAPIResourceList(gv)
	if resourceList == nil {
		http.NotFound(w, req)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resourceList)
}
