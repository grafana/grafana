package apiextensions

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
	"sync"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/endpoints/handlers/negotiation"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

// DynamicCRHandler handles HTTP requests for dynamically registered custom resources
type DynamicCRHandler struct {
	mu sync.RWMutex
	// Map of group -> version -> resource -> storage
	storageMap map[string]map[string]map[string]rest.Storage
	// Map of group -> version -> resource -> scope (Namespaced or Cluster)
	scopeMap map[string]map[string]map[string]apiextensionsv1.ResourceScope
	scheme   *runtime.Scheme
	codecs   serializer.CodecFactory
}

// NewDynamicCRHandler creates a new dynamic custom resource handler
func NewDynamicCRHandler(scheme *runtime.Scheme) *DynamicCRHandler {
	return &DynamicCRHandler{
		storageMap: make(map[string]map[string]map[string]rest.Storage),
		scheme:     scheme,
		codecs:     serializer.NewCodecFactory(scheme),
	}
}

type registeredCR struct {
	storage rest.Storage
	scope   apiextensionsv1.ResourceScope
}

// RegisterCustomResource registers a custom resource storage for dynamic routing
func (h *DynamicCRHandler) RegisterCustomResource(
	crd *apiextensionsv1.CustomResourceDefinition,
	version string,
	storage rest.Storage,
) {
	h.mu.Lock()
	defer h.mu.Unlock()

	group := crd.Spec.Group
	resource := crd.Spec.Names.Plural

	if h.storageMap[group] == nil {
		h.storageMap[group] = make(map[string]map[string]rest.Storage)
	}
	if h.storageMap[group][version] == nil {
		h.storageMap[group][version] = make(map[string]rest.Storage)
	}

	h.storageMap[group][version][resource] = storage

	// Store the scope information
	if h.scopeMap == nil {
		h.scopeMap = make(map[string]map[string]map[string]apiextensionsv1.ResourceScope)
	}
	if h.scopeMap[group] == nil {
		h.scopeMap[group] = make(map[string]map[string]apiextensionsv1.ResourceScope)
	}
	if h.scopeMap[group][version] == nil {
		h.scopeMap[group][version] = make(map[string]apiextensionsv1.ResourceScope)
	}
	h.scopeMap[group][version][resource] = crd.Spec.Scope

	fmt.Printf("DynamicCRHandler: Registered %s/%s/%s (scope: %s)\n", group, version, resource, crd.Spec.Scope)
}

// ServeHTTP handles HTTP requests for custom resources
func (h *DynamicCRHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// We could use a custom regex pattern, but RequestInfo is
	// already available and gives us the match info for free.
	requestInfo, ok := request.RequestInfoFrom(req.Context())
	if !ok || requestInfo == nil {
		http.NotFound(w, req)
		return
	}

	group := requestInfo.APIGroup
	version := requestInfo.APIVersion
	namespace := requestInfo.Namespace
	resource := requestInfo.Resource
	name := requestInfo.Name

	fmt.Printf("DynamicCRHandler: %s %s (group=%s, version=%s, resource=%s, namespace=%s, name=%s)\n",
		req.Method, req.URL.Path, group, version, resource, namespace, name)

	// Look up the storage
	h.mu.RLock()
	versionMap, groupExists := h.storageMap[group]
	if !groupExists {
		h.mu.RUnlock()
		http.NotFound(w, req)
		return
	}

	resourceMap, versionExists := versionMap[version]
	if !versionExists {
		h.mu.RUnlock()
		http.NotFound(w, req)
		return
	}

	storage, resourceExists := resourceMap[resource]
	if !resourceExists {
		h.mu.RUnlock()
		http.NotFound(w, req)
		return
	}

	// Check scope
	scope := h.scopeMap[group][version][resource]
	h.mu.RUnlock()

	// Validate scope matches the request
	if scope == apiextensionsv1.NamespaceScoped && namespace == "" {
		http.Error(w, fmt.Sprintf("resource %s is namespace-scoped, must specify namespace", resource), http.StatusBadRequest)
		return
	}
	if scope == apiextensionsv1.ClusterScoped && namespace != "" {
		http.Error(w, fmt.Sprintf("resource %s is cluster-scoped, cannot specify namespace", resource), http.StatusBadRequest)
		return
	}

	// Add request info to context
	ctx := req.Context()
	ctx = request.WithNamespace(ctx, namespace)
	ctx = request.WithRequestInfo(ctx, &request.RequestInfo{
		IsResourceRequest: true,
		Path:              req.URL.Path,
		Verb:              strings.ToLower(req.Method),
		APIGroup:          group,
		APIVersion:        version,
		Namespace:         namespace,
		Resource:          resource,
		Name:              name,
	})

	// Handle the request based on the storage interface
	h.handleStorageRequest(ctx, w, req, storage, name, namespace)
}

// handleStorageRequest dispatches to the appropriate storage method
func (h *DynamicCRHandler) handleStorageRequest(
	ctx context.Context,
	w http.ResponseWriter,
	req *http.Request,
	storage rest.Storage,
	name string,
	namespace string,
) {
	// Determine media type for response
	_, serializerInfo, err := negotiation.NegotiateOutputMediaType(req, h.codecs, negotiation.DefaultEndpointRestrictions)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to negotiate media type: %v", err), http.StatusNotAcceptable)
		return
	}
	serializer := serializerInfo.Serializer

	switch req.Method {
	case http.MethodGet:
		if name == "" {
			// List operation
			if lister, ok := storage.(rest.Lister); ok {
				h.handleList(ctx, w, req, lister, serializer)
			} else {
				http.Error(w, "list not supported", http.StatusMethodNotAllowed)
			}
		} else {
			// Get operation
			if getter, ok := storage.(rest.Getter); ok {
				h.handleGet(ctx, w, req, getter, name, serializer)
			} else {
				http.Error(w, "get not supported", http.StatusMethodNotAllowed)
			}
		}

	case http.MethodPost:
		// Create operation
		if creater, ok := storage.(rest.Creater); ok {
			h.handleCreate(ctx, w, req, creater, serializer)
		} else {
			http.Error(w, "create not supported", http.StatusMethodNotAllowed)
		}

	case http.MethodPut:
		// Update operation
		if updater, ok := storage.(rest.Updater); ok {
			h.handleUpdate(ctx, w, req, updater, name, serializer)
		} else {
			http.Error(w, "update not supported", http.StatusMethodNotAllowed)
		}

	case http.MethodPatch:
		// Patch operation
		if patcher, ok := storage.(rest.Patcher); ok {
			h.handlePatch(ctx, w, req, patcher, name, serializer)
		} else {
			http.Error(w, "patch not supported", http.StatusMethodNotAllowed)
		}

	case http.MethodDelete:
		// Delete operation
		if deleter, ok := storage.(rest.GracefulDeleter); ok {
			h.handleDelete(ctx, w, req, deleter, name, serializer)
		} else {
			http.Error(w, "delete not supported", http.StatusMethodNotAllowed)
		}

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// Helper methods for each operation
func (h *DynamicCRHandler) handleList(ctx context.Context, w http.ResponseWriter, req *http.Request, lister rest.Lister, serializer runtime.Serializer) {
	// TODO(@konsalex): Parse list options from query parameters
	obj, err := lister.List(ctx, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to list: %v", err), http.StatusInternalServerError)
		return
	}

	h.writeResponse(w, obj, serializer)
}

func (h *DynamicCRHandler) handleGet(ctx context.Context, w http.ResponseWriter, req *http.Request, getter rest.Getter, name string, serializer runtime.Serializer) {
	// TODO(@konsalex): Parse get options
	obj, err := getter.Get(ctx, name, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get: %v", err), http.StatusInternalServerError)
		return
	}

	h.writeResponse(w, obj, serializer)
}

func (h *DynamicCRHandler) handleCreate(ctx context.Context, w http.ResponseWriter, req *http.Request, creater rest.Creater, serializer runtime.Serializer) {
	// Read the request body
	body, err := io.ReadAll(req.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read body: %v", err), http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	fmt.Printf("DynamicCRHandler: handleCreate received body: %s\n", string(body))

	// Decode the body
	decoder := h.codecs.UniversalDeserializer()
	obj, gvk, err := decoder.Decode(body, nil, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to decode body: %v", err), http.StatusBadRequest)
		return
	}

	fmt.Printf("DynamicCRHandler: Decoded object type: %T, GVK: %v\n", obj, gvk)

	// Ensure we have an unstructured object
	if obj == nil {
		http.Error(w, "decoded object is nil", http.StatusBadRequest)
		return
	}

	// Create the object
	fmt.Printf("DynamicCRHandler: Calling creater.Create...\n")
	created, err := creater.Create(ctx, obj, nil, nil)
	if err != nil {
		fmt.Printf("DynamicCRHandler: Create failed: %v\n", err)
		http.Error(w, fmt.Sprintf("failed to create: %v", err), http.StatusInternalServerError)
		return
	}

	fmt.Printf("DynamicCRHandler: Create succeeded, writing response\n")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := serializer.Encode(created, w); err != nil {
		fmt.Printf("DynamicCRHandler: Failed to encode response: %v\n", err)
	}
}

func (h *DynamicCRHandler) handleUpdate(ctx context.Context, w http.ResponseWriter, req *http.Request, updater rest.Updater, name string, serializer runtime.Serializer) {
	fmt.Printf("DynamicCRHandler: handleUpdate for resource: %s\n", name)

	// Read the request body
	body, err := io.ReadAll(req.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read body: %v", err), http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	// Decode the body
	decoder := h.codecs.UniversalDeserializer()
	obj, gvk, err := decoder.Decode(body, nil, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to decode body: %v", err), http.StatusBadRequest)
		return
	}

	fmt.Printf("DynamicCRHandler: Decoded object type: %T, GVK: %v\n", obj, gvk)

	// Create UpdatedObjectInfo
	objInfo := rest.DefaultUpdatedObjectInfo(obj)

	// Update the object
	updated, created, err := updater.Update(ctx, name, objInfo, nil, nil, false, nil)
	if err != nil {
		fmt.Printf("DynamicCRHandler: Update failed: %v\n", err)
		if apierrors.IsNotFound(err) {
			http.Error(w, fmt.Sprintf("resource not found: %v", err), http.StatusNotFound)
		} else {
			http.Error(w, fmt.Sprintf("failed to update: %v", err), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if created {
		w.WriteHeader(http.StatusCreated)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	fmt.Printf("DynamicCRHandler: Update succeeded\n")
	if err := serializer.Encode(updated, w); err != nil {
		fmt.Printf("DynamicCRHandler: Failed to encode response: %v\n", err)
	}
}

func (h *DynamicCRHandler) handlePatch(ctx context.Context, w http.ResponseWriter, req *http.Request, patcher rest.Patcher, name string, serializer runtime.Serializer) {
	// rest.Patcher is actually just Getter + Updater
	// We need to get the existing object, apply the patch, then update

	// Read the request body
	patchBytes, err := io.ReadAll(req.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read body: %v", err), http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	// Get the existing object to verify it exists
	_, err = patcher.Get(ctx, name, nil)
	if err != nil {
		if apierrors.IsNotFound(err) {
			http.Error(w, fmt.Sprintf("resource not found: %v", err), http.StatusNotFound)
		} else {
			http.Error(w, fmt.Sprintf("failed to get resource: %v", err), http.StatusInternalServerError)
		}
		return
	}

	// Determine patch type from Content-Type header
	// Using mime here as content type might be like:
	// "Content-Type: application/json; charset=utf-8"
	contentType, _, err := mime.ParseMediaType(req.Header.Get("Content-Type"))
	if err != nil {
		http.Error(w, fmt.Sprintf("error parsing Content-Type: %s", contentType), http.StatusUnsupportedMediaType)
		return
	}

	var patchType types.PatchType

	switch contentType {
	case string(types.JSONPatchType):
		patchType = types.JSONPatchType
	case string(types.MergePatchType):
		patchType = types.MergePatchType
	case string(types.StrategicMergePatchType):
		patchType = types.StrategicMergePatchType
	case "application/json":
		// Default to merge patch for plain JSON
		// We cannot fall back to Strategic as we miss
		// Go structs for dynamic CRDs
		patchType = types.MergePatchType
	default:
		http.Error(w, fmt.Sprintf("unsupported Content-Type: %s", contentType), http.StatusUnsupportedMediaType)
		return
	}

	// Apply the patch via our custom storage (which has the Patch method)
	if storage, ok := patcher.(*customResourceStorage); ok {
		patched, err := storage.Patch(ctx, name, patchType, patchBytes, nil)
		if err != nil {
			if apierrors.IsNotFound(err) {
				http.Error(w, fmt.Sprintf("resource not found: %v", err), http.StatusNotFound)
			} else {
				http.Error(w, fmt.Sprintf("failed to patch: %v", err), http.StatusInternalServerError)
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := serializer.Encode(patched, w); err != nil {
			fmt.Printf("DynamicCRHandler: Failed to encode response: %v\n", err)
		}
	} else {
		http.Error(w, "patch not supported for this resource type", http.StatusNotImplemented)
	}
}

func (h *DynamicCRHandler) handleDelete(ctx context.Context, w http.ResponseWriter, req *http.Request, deleter rest.GracefulDeleter, name string, serializer runtime.Serializer) {
	// Parse delete options from query/body
	deleteOptions := &metav1.DeleteOptions{}

	// Delete the object
	obj, deleted, err := deleter.Delete(ctx, name, nil, deleteOptions)
	if err != nil {
		if apierrors.IsNotFound(err) {
			http.Error(w, fmt.Sprintf("resource not found: %v", err), http.StatusNotFound)
		} else {
			http.Error(w, fmt.Sprintf("failed to delete: %v", err), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if deleted {
		w.WriteHeader(http.StatusOK)
	} else {
		// Return 202 Accepted if deletion is pending (e.g., finalizers)
		w.WriteHeader(http.StatusAccepted)
	}
	if err := serializer.Encode(obj, w); err != nil {
		fmt.Printf("DynamicCRHandler: Failed to encode response: %v\n", err)
	}
}

func (h *DynamicCRHandler) writeResponse(w http.ResponseWriter, obj runtime.Object, serializer runtime.Serializer) {
	w.Header().Set("Content-Type", "application/json")
	if err := serializer.Encode(obj, w); err != nil {
		http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
	}
}
