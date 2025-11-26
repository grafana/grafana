package apiextensions

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	authlib "github.com/grafana/authlib/types"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apiextensions-apiserver/pkg/controller/openapi/builder"
	apiextensionsfeatures "k8s.io/apiextensions-apiserver/pkg/features"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// DynamicRegistry manages the dynamic registration and unregistration of custom resources
type DynamicRegistry struct {
	scheme           *runtime.Scheme
	optsGetter       generic.RESTOptionsGetter
	unifiedClient    resource.ResourceClient
	apiGroupInfo     *genericapiserver.APIGroupInfo
	accessClient     authlib.AccessClient
	server           *genericapiserver.GenericAPIServer // API server to install new groups
	discoveryManager *DiscoveryManager

	mu            sync.RWMutex
	registrations map[string]*customResourceRegistration    // key: group/version/resource
	apiGroups     map[string]*genericapiserver.APIGroupInfo // key: group name

	// openAPISpecs caches OpenAPI specs per GroupVersion and CRD Name
	openAPISpecs map[schema.GroupVersion]map[string]*spec3.OpenAPI
}

type customResourceRegistration struct {
	crd     *apiextensionsv1.CustomResourceDefinition
	storage *customResourceStorage
}

// NewDynamicRegistry creates a new dynamic registry
func NewDynamicRegistry(
	scheme *runtime.Scheme,
	optsGetter generic.RESTOptionsGetter,
	apiGroupInfo *genericapiserver.APIGroupInfo,
	accessClient authlib.AccessClient,
) *DynamicRegistry {
	return &DynamicRegistry{
		scheme:           scheme,
		optsGetter:       optsGetter,
		apiGroupInfo:     apiGroupInfo,
		accessClient:     accessClient,
		discoveryManager: NewDiscoveryManager(),
		registrations:    make(map[string]*customResourceRegistration),
		apiGroups:        make(map[string]*genericapiserver.APIGroupInfo),
		openAPISpecs:     make(map[schema.GroupVersion]map[string]*spec3.OpenAPI),
	}
}

// SetAPIServer sets the API server for dynamic group installation
func (r *DynamicRegistry) SetAPIServer(server *genericapiserver.GenericAPIServer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.server = server

	// Register discovery handlers for any API groups that were registered before we had the server reference
	for groupName := range r.apiGroups {
		// Find the version for this group
		for _, reg := range r.registrations {
			if reg.crd.Spec.Group == groupName {
				versionName := reg.crd.Spec.Versions[0].Name
				r.registerDiscoveryHandlers(groupName, versionName)
				break
			}
		}
	}

	// Wrap the main /apis handler to include our custom groups
	r.registerAllWithAggregatedDiscovery()

	// Note: OpenAPI registration is deferred to a PostStartHook because
	// OpenAPIV3VersionedService is only available after PrepareRun()
}

// RegisterOpenAPIForExistingCRDs registers OpenAPI specs for all existing CRDs
// This is called from a PostStartHook after the server is fully prepared
func (r *DynamicRegistry) RegisterOpenAPIForExistingCRDs() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Register OpenAPI specs for all CRDs that were registered before the server was fully prepared
	for _, reg := range r.registrations {
		if err := r.updateOpenAPISpecLocked(reg.crd); err != nil {
			fmt.Printf("Warning: failed to update OpenAPI spec for CRD %s: %v\n", reg.crd.Name, err)
		}
	}

	return nil
}

// registerDiscoveryHandlers registers HTTP handlers for discovery endpoints
func (r *DynamicRegistry) registerDiscoveryHandlers(group, version string) {
	if r.server == nil {
		return
	}

	// Register /apis/<group> handler
	groupPath := fmt.Sprintf("/apis/%s", group)
	r.server.Handler.NonGoRestfulMux.HandleFunc(groupPath, func(w http.ResponseWriter, req *http.Request) {
		r.discoveryManager.ServeAPIGroup(w, req, group)
	})
	// DEBUG
	fmt.Printf("Registered discovery handler: %s\n", groupPath)

	// Register /apis/<group>/<version> handler
	gv := schema.GroupVersion{Group: group, Version: version}
	versionPath := fmt.Sprintf("/apis/%s/%s", group, version)
	r.server.Handler.NonGoRestfulMux.HandleFunc(versionPath, func(w http.ResponseWriter, req *http.Request) {
		r.discoveryManager.ServeAPIResourceList(w, req, gv)
	})
	fmt.Printf("Registered discovery handler: %s\n", versionPath)
}

// registerAllWithAggregatedDiscovery registers all custom groups with the server's aggregated discovery manager
func (r *DynamicRegistry) registerAllWithAggregatedDiscovery() {
	if r.server == nil || r.server.AggregatedDiscoveryGroupManager == nil {
		return
	}

	// Register each custom group with the discovery manager
	for _, apiGroup := range r.discoveryManager.apiGroups {
		for _, gvDiscovery := range apiGroup.Versions {
			r.registerWithAggregatedDiscovery(apiGroup.Name, gvDiscovery.Version)
		}
	}
}

// registerWithAggregatedDiscovery registers a specific group version with the aggregated discovery manager
func (r *DynamicRegistry) registerWithAggregatedDiscovery(groupName, versionName string) {
	if r.server == nil || r.server.AggregatedDiscoveryGroupManager == nil {
		return
	}

	// Get the resources for this version
	gvKey := fmt.Sprintf("%s/%s", groupName, versionName)
	resourceList := r.discoveryManager.resources[gvKey]

	if resourceList != nil {
		// Convert our metav1.APIResourceList to apidiscoveryv2.APIVersionDiscovery
		apiResources := make([]apidiscoveryv2.APIResourceDiscovery, 0, len(resourceList.APIResources))
		for _, res := range resourceList.APIResources {
			apiRes := apidiscoveryv2.APIResourceDiscovery{
				Resource: res.Name,
				ResponseKind: &metav1.GroupVersionKind{
					Group:   groupName,
					Version: versionName,
					Kind:    res.Kind,
				},
				Scope:      getScopeType(res.Namespaced),
				ShortNames: res.ShortNames,
				Verbs:      res.Verbs,
			}
			apiResources = append(apiResources, apiRes)
		}

		versionDiscovery := apidiscoveryv2.APIVersionDiscovery{
			Version:   versionName,
			Resources: apiResources,
		}

		// Create a manager with CRD source
		manager := r.server.AggregatedDiscoveryGroupManager.WithSource(aggregated.CRDSource)

		// Add group version
		manager.AddGroupVersion(
			groupName,
			versionDiscovery,
		)

		// Set priority to ensure it's discoverable
		gv := metav1.GroupVersion{
			Group:   groupName,
			Version: versionName,
		}
		manager.SetGroupVersionPriority(gv, 1000, 100)

		fmt.Printf("✅ Registered %s with AggregatedDiscoveryGroupManager (Source: CRD)\n", gvKey)
	}
}

// getScopeType converts boolean namespaced flag to apidiscoveryv2 scope type
func getScopeType(namespaced bool) apidiscoveryv2.ResourceScope {
	if namespaced {
		return apidiscoveryv2.ScopeNamespace
	}
	return apidiscoveryv2.ScopeCluster
}

// Start begins watching CRDs for dynamic registration
func (r *DynamicRegistry) Start(ctx context.Context, crdStore *genericregistry.Store) {
	// Currently we don't watch for changes
	// CRDs are loaded during UpdateAPIGroupInfo before the server starts
	// We need to implement proper watching mechanism here.
	// TODO(@konsalex): Watch for CRD changes and call RegisterCRD/UpdateCRD/UnregisterCRD
	<-ctx.Done()
}

// RegisterCRD registers a custom resource dynamically based on the CRD spec
func (r *DynamicRegistry) RegisterCRD(crd *apiextensionsv1.CustomResourceDefinition) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// TODO(@konsalex): Support multiple versions
	if len(crd.Spec.Versions) != 1 {
		return fmt.Errorf("only single-version CRDs are supported")
	}

	version := crd.Spec.Versions[0]

	// Create storage for the custom resource
	crStorage, err := NewCustomResourceStorage(
		crd,
		version.Name,
		r.scheme,
		r.optsGetter,
		r.accessClient,
		r.unifiedClient,
	)
	if err != nil {
		return fmt.Errorf("failed to create custom resource storage: %w", err)
	}

	// Get or create API group info for this custom resource's group
	group := crd.Spec.Group
	apiGroupInfo, ok := r.apiGroups[group]
	isNewGroup := !ok
	if !ok {
		// Create a simple API group info without using NewDefaultAPIGroupInfo
		// to avoid OpenAPI validation issues with unstructured types
		gvInfo := genericapiserver.APIGroupInfo{
			PrioritizedVersions:          []schema.GroupVersion{{Group: group, Version: version.Name}},
			VersionedResourcesStorageMap: make(map[string]map[string]rest.Storage),
			Scheme:                       r.scheme,
			NegotiatedSerializer:         r.apiGroupInfo.NegotiatedSerializer,
			ParameterCodec:               r.apiGroupInfo.ParameterCodec,
		}

		r.apiGroups[group] = &gvInfo
		apiGroupInfo = &gvInfo
	}

	// Get or create the storage map for this version
	storageMap, ok := apiGroupInfo.VersionedResourcesStorageMap[version.Name]
	if !ok {
		storageMap = make(map[string]rest.Storage)
		apiGroupInfo.VersionedResourcesStorageMap[version.Name] = storageMap

		// Update prioritized versions if this is a new version
		found := false
		for _, gv := range apiGroupInfo.PrioritizedVersions {
			if gv.Version == version.Name {
				found = true
				break
			}
		}
		if !found {
			apiGroupInfo.PrioritizedVersions = append(apiGroupInfo.PrioritizedVersions,
				schema.GroupVersion{Group: group, Version: version.Name})
		}
	}

	// Register the custom resource storage
	resourcePath := crd.Spec.Names.Plural
	storageMap[resourcePath] = crStorage

	// Register status subresource if defined
	// TODO(@konsalex): Implement status subresource for direct storage
	// if version.Subresources != nil && version.Subresources.Status != nil {
	// 	storageMap[resourcePath+"/status"] = crStorage
	// }

	// Store the registration
	key := fmt.Sprintf("%s/%s/%s", crd.Spec.Group, version.Name, crd.Spec.Names.Plural)
	r.registrations[key] = &customResourceRegistration{
		crd:     crd.DeepCopy(),
		storage: crStorage,
	}

	// Add to discovery manager
	// (this will make kubectl work properly)
	r.discoveryManager.AddCustomResource(crd)

	// Register discovery HTTP handlers if we have the server
	if r.server != nil && isNewGroup {
		r.registerDiscoveryHandlers(group, version.Name)
		// Also register with aggregated discovery manager
		r.registerWithAggregatedDiscovery(group, version.Name)
	}

	// Update OpenAPI spec
	if err := r.updateOpenAPISpecLocked(crd); err != nil {
		fmt.Printf("Warning: failed to update OpenAPI spec for CRD %s: %v\n", crd.Name, err)
	}

	return nil
}

// UpdateCRD updates a custom resource registration
func (r *DynamicRegistry) UpdateCRD(crd *apiextensionsv1.CustomResourceDefinition) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Hack for now, we just un-register it and the re-register it.
	// Not sure if there is any drawback
	if err := r.unregisterCRDLocked(crd); err != nil {
		return err
	}

	return r.RegisterCRD(crd)
}

// UnregisterCRD removes a custom resource registration
func (r *DynamicRegistry) UnregisterCRD(crd *apiextensionsv1.CustomResourceDefinition) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.unregisterCRDLocked(crd)
}

func (r *DynamicRegistry) unregisterCRDLocked(crd *apiextensionsv1.CustomResourceDefinition) error {
	if len(crd.Spec.Versions) != 1 {
		return fmt.Errorf("only single-version CRDs are supported")
	}

	version := crd.Spec.Versions[0]
	key := fmt.Sprintf("%s/%s/%s", crd.Spec.Group, version.Name, crd.Spec.Names.Plural)

	// Remove from registrations
	delete(r.registrations, key)

	// Remove from API group info storage map
	if storageMap, ok := r.apiGroupInfo.VersionedResourcesStorageMap[version.Name]; ok {
		resourcePath := crd.Spec.Names.Plural
		delete(storageMap, resourcePath)
		delete(storageMap, resourcePath+"/status")
	}

	// Remove from OpenAPI specs
	gv := schema.GroupVersion{Group: crd.Spec.Group, Version: version.Name}
	if specs, ok := r.openAPISpecs[gv]; ok {
		delete(specs, crd.Name)
		if len(specs) == 0 {
			delete(r.openAPISpecs, gv)
			// Remove from service
			if r.server != nil && r.server.OpenAPIV3VersionedService != nil {
				path := fmt.Sprintf("apis/%s/%s", gv.Group, gv.Version)
				r.server.OpenAPIV3VersionedService.DeleteGroupVersion(path)
			}
		} else {
			// Update with remaining specs
			if err := r.updateGroupVersionOpenAPILocked(gv); err != nil {
				return fmt.Errorf("failed to update OpenAPI spec after unregistering CRD: %w", err)
			}
		}
	}

	return nil
}

// GetRegistration returns the registration for a custom resource
func (r *DynamicRegistry) GetRegistration(group, version, resource string) (*customResourceRegistration, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	key := fmt.Sprintf("%s/%s/%s", group, version, resource)
	reg, ok := r.registrations[key]
	return reg, ok
}

// updateOpenAPISpecLocked builds and updates the OpenAPI spec for the given CRD
// mu must be held by caller
func (r *DynamicRegistry) updateOpenAPISpecLocked(crd *apiextensionsv1.CustomResourceDefinition) error {
	if r.server == nil || r.server.OpenAPIV3VersionedService == nil {
		return nil
	}

	for _, v := range crd.Spec.Versions {
		if !v.Served {
			continue
		}

		// Build OpenAPI V3 spec
		spec, err := builder.BuildOpenAPIV3(crd, v.Name, builder.Options{
			V2:                      false,
			IncludeSelectableFields: utilfeature.DefaultFeatureGate.Enabled(apiextensionsfeatures.CustomResourceFieldSelectors),
		})
		if err != nil {
			return fmt.Errorf("failed to build OpenAPI V3 spec: %w", err)
		}

		gv := schema.GroupVersion{Group: crd.Spec.Group, Version: v.Name}
		if r.openAPISpecs[gv] == nil {
			r.openAPISpecs[gv] = make(map[string]*spec3.OpenAPI)
		}
		r.openAPISpecs[gv][crd.Name] = spec

		// Update the group version spec in the service
		if err := r.updateGroupVersionOpenAPILocked(gv); err != nil {
			return err
		}
	}

	return nil
}

// updateGroupVersionOpenAPILocked merges all specs for a GV and updates the service
// mu must be held by caller
func (r *DynamicRegistry) updateGroupVersionOpenAPILocked(gv schema.GroupVersion) error {
	if r.server == nil || r.server.OpenAPIV3VersionedService == nil {
		return nil
	}

	specsMap := r.openAPISpecs[gv]
	if len(specsMap) == 0 {
		return nil
	}

	var specs []*spec3.OpenAPI
	for _, spec := range specsMap {
		specs = append(specs, spec)
	}

	mergedSpec, err := builder.MergeSpecsV3(specs...)
	if err != nil {
		return fmt.Errorf("failed to merge specs: %w", err)
	}

	path := fmt.Sprintf("apis/%s/%s", gv.Group, gv.Version)
	r.server.OpenAPIV3VersionedService.UpdateGroupVersion(path, mergedSpec)

	return nil
}
