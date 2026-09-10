package folders

import (
	"context"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subAccessREST struct {
	getter                rest.Getter
	accessClient          authlib.AccessClient
	userPermissionsClient authlib.UserPermissionsClient
	useExternalGroups     bool
}

var _ = rest.Connecter(&subAccessREST{})
var _ = rest.StorageMetadata(&subAccessREST{})

func (r *subAccessREST) New() runtime.Object {
	return &foldersV1.FolderAccessInfo{}
}

func (r *subAccessREST) Destroy() {
}

func (r *subAccessREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subAccessREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subAccessREST) ProducesObject(verb string) interface{} {
	return &foldersV1.FolderAccessInfo{}
}

func (r *subAccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		access, err := r.getAccessInfo(ctx, name)
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(200, access)
		}
	}), nil
}

var folderAccessChecks = []struct {
	correlationID string
	verb          string
}{
	{correlationID: "update", verb: utils.VerbUpdate},
	{correlationID: "delete", verb: utils.VerbDelete},
	{correlationID: "setperms", verb: utils.VerbSetPermissions},
}

func (r *subAccessREST) getAccessInfo(ctx context.Context, name string) (*foldersV1.FolderAccessInfo, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// sharedwithme is a virtual aggregation view with no RBAC scope and nothing
	// to act on, so report no access instead of probing for a missing object.
	if name == folder.SharedWithMeFolderUID {
		return &foldersV1.FolderAccessInfo{}, nil
	}

	if folder.IsRootFolderUID(name) {
		return r.checkAccess(ctx, ns.Value, user, folder.GeneralFolderUID, "")
	}

	f, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(f)
	if err != nil {
		return nil, err
	}

	return r.checkAccess(ctx, ns.Value, user, name, obj.GetFolder())
}

func (r *subAccessREST) checkAccess(ctx context.Context, namespace string, user identity.Requester, name, parent string) (*foldersV1.FolderAccessInfo, error) {
	checks := make([]authlib.BatchCheckItem, len(folderAccessChecks))
	for i, c := range folderAccessChecks {
		checks[i] = authlib.BatchCheckItem{
			CorrelationID: c.correlationID,
			Verb:          c.verb,
			Group:         foldersV1.GROUP,
			Resource:      foldersV1.RESOURCE,
			Name:          name,
			Folder:        parent,
		}
	}

	batchResp, err := r.accessClient.BatchCheck(ctx, user, authlib.BatchCheckRequest{
		Namespace: namespace,
		Checks:    checks,
	})
	if err != nil {
		return nil, err
	}

	allowed := make(map[string]bool, len(folderAccessChecks))
	for _, c := range folderAccessChecks {
		result := batchResp.Results[c.correlationID]
		if result.Error != nil {
			return nil, result.Error
		}
		allowed[c.correlationID] = result.Allowed
	}

	metadata, err := r.getAccessControlMetadata(ctx, namespace, user, name, parent)
	if err != nil {
		return nil, err
	}

	canAdmin := allowed["setperms"]
	return &foldersV1.FolderAccessInfo{
		CanAdmin:      canAdmin,
		CanEdit:       canAdmin || allowed["update"],
		CanSave:       canAdmin || allowed["update"],
		CanDelete:     canAdmin || allowed["delete"],
		AccessControl: metadata,
	}, nil
}

func (r *subAccessREST) getAccessControlMetadata(ctx context.Context, namespace string, user identity.Requester, name, parent string) (map[string]bool, error) {
	groups := user.GetGroups()
	if r.useExternalGroups {
		groups = user.GetExternalGroups()
	}
	permissions, err := r.userPermissionsClient.GetUserPermissions(ctx, folderPermissionsAuthInfo{
		AuthInfo: user, namespace: namespace, groups: groups,
	}, authlib.GetUserPermissionsRequest{Namespace: namespace})
	if err != nil {
		return nil, err
	}

	// Match parent scopes as well as direct grants, without requiring a user to
	// hold the entire Viewer/Editor/Admin role for an individual action to count.
	folderIDs := map[string]bool{name: true}
	for !folder.IsRootFolderUID(parent) {
		if folderIDs[parent] {
			return nil, folder.ErrCyclicReference.Errorf("cyclic folder references found: %s", parent)
		}
		folderIDs[parent] = true
		f, err := r.getter.Get(ctx, parent, &v1.GetOptions{})
		if err != nil {
			return nil, err
		}
		meta, err := utils.MetaAccessor(f)
		if err != nil {
			return nil, err
		}
		parent = meta.GetFolder()
	}

	byAction := make(map[string][]string)
	for _, permission := range permissions.Permissions {
		byAction[permission.Action] = append(byAction[permission.Action], permission.Scope)
	}
	var metadata map[string]bool
	for _, actions := range accesscontrol.GetResourcesMetadata(ctx, byAction, folder.ScopeFoldersPrefix, folderIDs) {
		if metadata == nil {
			metadata = make(map[string]bool)
		}
		for action := range actions {
			metadata[action] = true
		}
	}
	return metadata, nil
}

type folderPermissionsAuthInfo struct {
	authlib.AuthInfo
	namespace string
	groups    []string
}

func (i folderPermissionsAuthInfo) GetNamespace() string {
	return i.namespace
}

func (i folderPermissionsAuthInfo) GetGroups() []string {
	return i.groups
}

func (folderPermissionsAuthInfo) GetTokenDelegatedPermissions() []string {
	return []string{"authz.grafana.app/userpermissions:get"}
}
