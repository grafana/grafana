package apiserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/conversion"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/k8s/authnz"
	"github.com/grafana/grafana/pkg/services/store/entity"
	userpkg "github.com/grafana/grafana/pkg/services/user"
	customStorage "k8s.io/apiextensions-apiserver/pkg/storage"
	"k8s.io/apiextensions-apiserver/pkg/storage/filepath"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"
)

var _ customStorage.Storage = (*entityStorage)(nil)

// wrap the filepath storage so we can test overriding functions
type entityStorage struct {
	log            log.Logger
	userService    userpkg.Service
	acService      accesscontrol.Service
	entityStore    entity.EntityStoreServer
	gr             schema.GroupResource
	strategy       customStorage.Strategy
	optsGetter     generic.RESTOptionsGetter
	tableConvertor rest.TableConvertor
	newFunc        customStorage.NewObjectFunc
	newListFunc    customStorage.NewObjectFunc
	ws             *WatchSet
}

func ProvideStorage(userService userpkg.Service, acService accesscontrol.Service) customStorage.NewStorageFunc {
	return func(
		gr schema.GroupResource,
		strategy customStorage.Strategy,
		optsGetter generic.RESTOptionsGetter,
		tableConvertor rest.TableConvertor,
		newFunc customStorage.NewObjectFunc,
		newListFunc customStorage.NewObjectFunc,
	) (customStorage.Storage, error) {
		fmt.Printf("create storage for GR: %v", gr)

		// CRDs
		if strings.HasSuffix(gr.Group, "k8s.io") {
			return filepath.Storage(gr, strategy, optsGetter, tableConvertor, newFunc, newListFunc)
		}

		return &entityStorage{
			log:            log.New("k8s.apiserver.storage"),
			userService:    userService,
			acService:      acService,
			entityStore:    entity.WireCircularDependencyHack,
			gr:             gr,
			ws:             NewWatchSet(),
			strategy:       strategy,
			optsGetter:     optsGetter,
			tableConvertor: tableConvertor,
			newFunc:        newFunc,
			newListFunc:    newListFunc,
		}, nil
	}
}

func (s *entityStorage) New() runtime.Object {
	return s.newFunc()
}

func (s *entityStorage) NewList() runtime.Object {
	return s.newListFunc()
}

func (s *entityStorage) ShortNames() []string {
	return s.strategy.ShortNames()
}

func (s *entityStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj := s.newFunc().(*unstructured.Unstructured)
	objMeta, err := apimeta.Accessor(obj)
	if err != nil {
		return nil, err
	}
	objMeta.SetName(name)
	objMeta.SetNamespace("default")

	user, err := s.getSignedInUser(ctx, obj)
	if err != nil {
		return nil, err
	}

	out, err := s.entityStore.Read(appcontext.WithUser(ctx, user), &entity.ReadEntityRequest{
		GRN: &entity.GRN{
			TenantId: user.OrgID,
			Kind:     strings.ToLower(obj.GetObjectKind().GroupVersionKind().Kind),
			UID:      name, // the UID
		},
		WithBody:   true,
		WithStatus: true,
	})
	if err != nil {
		return nil, err
	}
	if out == nil || out.GRN == nil {
		return nil, apierrors.NewNotFound(s.gr, name)
	}

	objMeta.SetUID(types.UID(out.Guid))
	objMeta.SetResourceVersion(formatResourceVersion(out.Version))

	var spec map[string]interface{}
	err = json.Unmarshal(out.Body, &spec)
	if err != nil {
		return nil, err
	}
	obj.Object["spec"] = spec

	return obj, nil
}

func (s *entityStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	user, err := s.getSignedInUser(ctx, obj)
	if err != nil {
		return nil, err
	}
	cmd, err := objectToWriteCommand(user.OrgID, obj)
	if err != nil {
		return nil, err
	}
	if cmd.GRN.Kind == "" {
		cmd.GRN.Kind = s.gr.Resource // CRD?
	}

	out, err := s.entityStore.Write(appcontext.WithUser(ctx, user), cmd)
	if err != nil {
		return nil, err
	}

	objMeta, err := apimeta.Accessor(obj)
	if err != nil {
		return nil, err
	}

	objMeta.SetUID(types.UID(out.GUID))
	objMeta.SetResourceVersion(formatResourceVersion(out.Entity.Version))

	s.notifyWatchers(watch.Event{
		Type:   watch.Added,
		Object: obj,
	})
	return obj, nil
}

func (s *entityStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := s.getSignedInUser(ctx, nil) // ???? TODO?????
	if err != nil {
		return nil, err
	}

	// HACK
	k := strings.ToLower(s.gr.Resource)
	k = strings.TrimSuffix(k, "s") // remove the trailing "s"

	rsp, err := s.entityStore.Search(appcontext.WithUser(ctx, user), &entity.EntitySearchRequest{
		Limit:      options.Limit,
		Kind:       []string{k},
		WithBody:   true,
		WithLabels: true,
	})
	if err != nil {
		return nil, err
	}

	p := newSelectionPredicate(options)
	newListObj := s.NewList()
	// newListObj.SetContinue(rsp.NextPageToken)
	v, err := getListPrt(newListObj)
	if err != nil {
		return nil, err
	}

	for _, r := range rsp.Results {
		obj := searchResultToK8s(s.newFunc().(*unstructured.Unstructured), r)
		ok, err := p.Matches(obj)
		if err != nil {
			return nil, err
		}
		if ok {
			appendItem(v, obj)
		}
	}
	return newListObj, nil
}

func (s *entityStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	user, err := s.getSignedInUser(ctx, nil) // ???? TODO?????
	if err != nil {
		return nil, false, err
	}
	ctx = appcontext.WithUser(ctx, user)

	var isCreate bool
	var isDelete bool
	// attempt to update the object, automatically retrying on storage-level conflicts
	// (see guaranteedUpdate docs for details)
	obj, err := s.guaranteedUpdate(ctx, user.OrgID, name, func(input runtime.Object) (output runtime.Object, err error) {
		isCreate = false
		isDelete = false

		if input == nil {
			if !forceAllowCreate {
				return nil, apierrors.NewNotFound(s.gr, name)
			}
			isCreate = true
		}
		inputVersion, err := getResourceVersion(input)
		if err != nil {
			return nil, err
		}

		output, err = objInfo.UpdatedObject(ctx, input)
		if err != nil {
			return nil, err
		}

		// this check MUST happen before rest.BeforeUpdate is called - for subresource updates, it'll
		// use the input (storage version) to copy the subresource to (to avoid changing the spec),
		// so the version from the request object will be lost, breaking optimistic concurrency
		updatedVersion, err := getResourceVersion(output)
		if err != nil {
			return nil, err
		}
		if inputVersion != updatedVersion {
			return nil, s.conflictErr(name)
		}

		if err := rest.BeforeUpdate(s.strategy, ctx, output, input); err != nil {
			return nil, err
		}

		if isCreate {
			if createValidation != nil {
				return nil, fmt.Errorf("update createValidation not supported")
			}
			return output, nil
		}

		if updateValidation != nil {
			return nil, fmt.Errorf("update updateValidation not supported")
		}

		outputMeta, err := apimeta.Accessor(output)
		if err != nil {
			return nil, err
		}

		// handle 2-phase deletes -> for entities with finalizers, DeletionTimestamp is set and reconcilers execute +
		// remove them (triggering more updates); once drained, it can be deleted from the final update operation
		// loosely based off https://github.com/kubernetes/apiserver/blob/947ebe755ed8aed2e0f0f5d6420caad07fc04cc2/pkg/registry/generic/registry/store.go#L624
		if len(outputMeta.GetFinalizers()) == 0 && !outputMeta.GetDeletionTimestamp().IsZero() {
			// to simplify semantics here, we allow this update to go through and then
			// delete it - if this becomes a bottleneck (seems unlikely), we can delete
			// here and return a special sentinel error
			isDelete = true
			return output, nil
		}

		return output, nil
	})
	if err != nil {
		// TODO(milas): we need a better way of handling standard errors and
		// 	wrapping any others in generic apierrors - returning plain Go errors
		// 	(which still happens in some code paths) makes apiserver log out
		// 	warnings, though it doesn't actually break things so is not critical
		if os.IsNotExist(err) {
			return nil, false, apierrors.NewNotFound(s.gr, name)
		}
		return nil, false, err
	}

	if isCreate {
		s.notifyWatchers(watch.Event{
			Type:   watch.Added,
			Object: obj,
		})
		return obj, true, nil
	}

	if isDelete {
		if true {
			return nil, false, fmt.Errorf("delete not implemented yet")
		}
		// TODO... delete from upate ????
		// filename := f.objectFileName(ctx, name)
		// if err := f.fs.Remove(filename); err != nil {
		// 	if os.IsNotExist(err) {
		// 		return nil, false, apierrors.NewNotFound(s.gr, name)
		// 	}
		// 	return nil, false, err
		// }

		s.notifyWatchers(watch.Event{
			Type:   watch.Deleted,
			Object: obj,
		})
		return obj, false, nil
	}

	s.notifyWatchers(watch.Event{
		Type:   watch.Modified,
		Object: obj,
	})
	return obj, false, nil
}

// updateFunc should return the updated object to persist to storage.
//
// This function might be called more than once, so must be idempotent. If an
// error is returned from it, the error will be propagated and the update halted.
type updateFunc func(input runtime.Object) (output runtime.Object, err error)

// guaranteedUpdate keeps calling tryUpdate to update an object retrying the update
// until success if there is a storage-level conflict.
//
// The input object passed to tryUpdate may change across invocations of tryUpdate
// if other writers are simultaneously updating it, so tryUpdate needs to take into
// account the current contents of the object when deciding how the update object
// should look.
//
// The "guaranteed" in the name comes from a method of the same name in the
// Kubernetes apiserver/etcd code. Most of this method comment is copied from
// its godoc.
//
// See https://github.com/kubernetes/apiserver/blob/544b6014f353b0f5e7c6fd2d3e04a7810d0ba5fc/pkg/storage/interfaces.go#L205-L238
func (s *entityStorage) guaranteedUpdate(ctx context.Context, orgId int64, name string, tryUpdate updateFunc) (runtime.Object, error) {
	// technically, this loop should be safe to run indefinitely, but a cap is
	// applied to avoid bugs resulting in an infinite* loop
	//
	// if the cap is hit, an internal server error will be returned
	//
	// * really until the context is canceled, but busy looping here for ~30 secs
	//   until it times out is not great either
	const maxAttempts = 20
	for i := 0; i < maxAttempts; i++ {
		if err := ctx.Err(); err != nil {
			// the FS layer doesn't use context, so we explicitly check it on
			// each loop iteration so that we'll stop retrying if the context
			// gets canceled (e.g. request timeout)
			return nil, err
		}

		// Do a get (pretty sure this should all be implemented inside EntityAPI)
		storageObj, err := s.Get(ctx, name, nil)
		if err != nil && !apierrors.IsNotFound(err) {
			// some objects allow create-on-update semantics, so NotFound is not terminal
			return nil, err
		}

		out, err := tryUpdate(storageObj)
		if err != nil {
			// TODO(milas): check error type and wrap if necessary
			return nil, err
		}

		cmd, err := objectToWriteCommand(orgId, out)
		if err != nil {
			return nil, err
		}
		eout, err := s.entityStore.Write(ctx, cmd)
		if err != nil {
			return nil, err
		}
		objMeta, err := apimeta.Accessor(out)
		if err != nil {
			return nil, err
		}
		if 1 == 3 { // Version error???
			continue
		}

		objMeta.SetUID(types.UID(eout.GUID))
		objMeta.SetResourceVersion(formatResourceVersion(eout.Entity.Version))

		// filename := s.objectFileName(ctx, name)
		// if err := f.fs.Write(f.codec, filename, out, storageVersion); err != nil {
		// 	if errors.Is(err, VersionError) {
		// 		// storage conflict, retry
		// 		continue
		// 	}
		// 	return nil, err
		// }
		return out, nil
	}

	// a non-early return means the loop exhausted all attempts
	return nil, apierrors.NewInternalError(errors.New("failed to persist to storage"))
}

func (s *entityStorage) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	p := newSelectionPredicate(options)
	jw := s.ws.newWatch()

	// On initial watch, send all the existing objects
	list, err := s.List(ctx, options)
	if err != nil {
		return nil, err
	}

	danger := reflect.ValueOf(list).Elem()
	items := danger.FieldByName("Items")

	initEvents := []watch.Event{}
	for i := 0; i < items.Len(); i++ {
		obj := items.Index(i).Addr().Interface().(runtime.Object)
		ok, err := p.Matches(obj)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		initEvents = append(initEvents, watch.Event{
			Type:   watch.Added,
			Object: obj,
		})
	}
	jw.Start(p, initEvents)

	return jw, nil
}

func (s *entityStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("DELETE not implemented (" + name + ")")
}

func (s *entityStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection not implemented")
}

func (s *entityStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *entityStorage) Destroy() {
	// destroy
}

func (s *entityStorage) GetCreateStrategy() rest.RESTCreateStrategy {
	return s.strategy
}

func (s *entityStorage) GetUpdateStrategy() rest.RESTUpdateStrategy {
	return s.strategy
}

func (s *entityStorage) GetDeleteStrategy() rest.RESTDeleteStrategy {
	return s.strategy
}

func (s *entityStorage) GetStrategy() customStorage.Strategy {
	return s.strategy
}

func (s *entityStorage) SetStrategy(strategy customStorage.Strategy) {
	s.strategy = strategy
}

func (s *entityStorage) NamespaceScoped() bool {
	return s.strategy.NamespaceScoped()
}

func (s *entityStorage) notifyWatchers(ev watch.Event) {
	s.ws.notifyWatchers(ev)
}

func (s *entityStorage) conflictErr(name string) error {
	return apierrors.NewConflict(
		s.gr,
		name,
		errors.New(registry.OptimisticLockErrorMsg))
}

func (s *entityStorage) getSignedInUser(ctx context.Context, obj runtime.Object) (*userpkg.SignedInUser, error) {
	user, ok := request.UserFrom(ctx)
	if !ok {
		return nil, s.newForbiddenError(obj, "unable to fetch user from context")
	}

	var err error
	userQuery := userpkg.GetSignedInUserQuery{}

	s.log.Warn("user", "user", user)
	if user.GetName() == authnz.ApiServerUser || user.GetName() == authnz.ApiServerAnonymous {
		userQuery.OrgID = 1
		userQuery.UserID = 1
	} else if len(user.GetExtra()["user-id"]) == 0 || len(user.GetExtra()["org-id"]) == 0 {
		return nil, fmt.Errorf("insufficient information on user context, couldn't determine UserID and OrgID")
	} else {
		userQuery.UserID, err = strconv.ParseInt(user.GetExtra()["user-id"][0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana user id from extras map")
		}

		userQuery.OrgID, err = strconv.ParseInt(user.GetExtra()["org-id"][0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana org id from extras map")
		}
	}

	signedInUser, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &userQuery)
	if err != nil {
		return nil, s.newForbiddenError(obj,
			fmt.Sprintf("could not determine the user backing the service account: %s", err.Error()))
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if signedInUser.Permissions[signedInUser.OrgID] == nil {
		permissions, err := s.acService.GetUserPermissions(ctx, signedInUser, accesscontrol.Options{})
		if err != nil {
			fmt.Errorf("failed fetching permissions for user: userID=%d, error=%s", signedInUser.UserID, err.Error())
		}
		signedInUser.Permissions[signedInUser.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	}

	return signedInUser, nil
}

func (s *entityStorage) newForbiddenError(obj runtime.Object, msg string) error {
	name := ""
	if obj != nil {
		accessor, err := apimeta.Accessor(obj)
		if err == nil {
			name = accessor.GetName()
		}
	}
	return apierrors.NewForbidden(s.gr, name, fmt.Errorf(msg))
}

func newSelectionPredicate(options *internalversion.ListOptions) storage.SelectionPredicate {
	p := storage.SelectionPredicate{
		Label:    labels.Everything(),
		Field:    fields.Everything(),
		GetAttrs: storage.DefaultClusterScopedAttr,
	}
	if options != nil {
		if options.LabelSelector != nil {
			p.Label = options.LabelSelector
		}
		if options.FieldSelector != nil {
			p.Field = options.FieldSelector
		}
	}
	return p
}

func getListPrt(listObj runtime.Object) (reflect.Value, error) {
	listPtr, err := apimeta.GetItemsPtr(listObj)
	if err != nil {
		return reflect.Value{}, err
	}
	v, err := conversion.EnforcePtr(listPtr)
	if err != nil || v.Kind() != reflect.Slice {
		return reflect.Value{}, fmt.Errorf("need ptr to slice: %v", err)
	}
	return v, nil
}

func appendItem(v reflect.Value, obj runtime.Object) {
	v.Set(reflect.Append(v, reflect.ValueOf(obj).Elem()))
}
