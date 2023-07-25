package entity

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/grafana/grafana/pkg/kinds"
	entityStore "github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

type Key struct {
	Group     string
	Kind      string
	Namespace string
	Name      string
}

func ParseKey(key string) (*Key, error) {
	// /<group>/<kind plural lowercase>/<namespace>/<name>
	parts := strings.Split(key, "/")
	if len(parts) != 5 {
		return nil, fmt.Errorf("invalid key (expecting 4 parts) " + key)
	}

	return &Key{
		Group:     parts[1],
		Kind:      parts[2],
		Namespace: parts[3],
		Name:      parts[4],
	}, nil
}

func (k *Key) String() string {
	return fmt.Sprintf("/%s/%s/%s/%s", k.Group, k.Kind, k.Namespace, k.Name)
}

func (k *Key) IsEqual(other *Key) bool {
	return k.Group == other.Group && k.Kind == other.Kind && k.Namespace == other.Namespace && k.Name == other.Name
}

func (k *Key) TenantID() (int64, error) {
	if k.Namespace == "default" {
		return 1, nil
	}
	tid := strings.Split(k.Namespace, "-")
	if len(tid) != 2 || !(tid[0] == "org" || tid[0] == "tenant") {
		return 0, fmt.Errorf("invalid namespace, expected org|tenant-${#}")
	}
	intVar, err := strconv.ParseInt(tid[1], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid namespace, expected number")
	}
	return intVar, nil
}

func (k *Key) ToGRN(kindName string) (*grn.GRN, error) {
	tid, err := k.TenantID()
	if err != nil {
		return nil, err
	}

	return &grn.GRN{
		ResourceGroup:      k.Group,
		ResourceKind:       kindName,
		ResourceIdentifier: k.Name,
		TenantID:           tid,
	}, nil
}

// Convert an etcd key to GRN style
func keyToGRN(key string, kindName string) (*grn.GRN, error) {
	k, err := ParseKey(key)
	if err != nil {
		return nil, err
	}
	return k.ToGRN(kindName)
}

// this is terrible... but just making it work!!!!
func entityToResource(rsp *entityStore.Entity, res runtime.Object) error {
	var err error

	metaAccessor, err := meta.Accessor(res)
	if err != nil {
		return err
	}

	if rsp.GRN == nil {
		return fmt.Errorf("invalid entity, missing GRN")
	}

	if len(rsp.Meta) > 0 {
		err = json.Unmarshal(rsp.Meta, res)
		if err != nil {
			return err
		}
	}

	metaAccessor.SetName(rsp.GRN.ResourceIdentifier)
	if rsp.GRN.TenantID != 1 {
		metaAccessor.SetNamespace(fmt.Sprintf("tenant-%d", rsp.GRN.TenantID))
	} else {
		metaAccessor.SetNamespace("default") // org 1
	}
	res.GetObjectKind().SetGroupVersionKind(schema.GroupVersionKind{
		Group:   rsp.GRN.ResourceGroup,
		Version: rsp.GroupVersion,
		Kind:    rsp.GRN.ResourceKind,
	})
	metaAccessor.SetUID(types.UID(rsp.Guid))
	metaAccessor.SetResourceVersion(rsp.Version)
	metaAccessor.SetCreationTimestamp(metav1.Unix(rsp.CreatedAt/1000, rsp.CreatedAt%1000*1000000))

	grafanaAccessor := kinds.MetaAccessor(metaAccessor)

	if rsp.Folder != "" {
		grafanaAccessor.SetFolder(rsp.Folder)
	}
	if rsp.CreatedBy != "" {
		grafanaAccessor.SetCreatedBy(rsp.CreatedBy)
	}
	if rsp.UpdatedBy != "" {
		grafanaAccessor.SetUpdatedBy(rsp.UpdatedBy)
	}
	if rsp.UpdatedAt != 0 {
		updatedAt := time.UnixMilli(rsp.UpdatedAt).UTC()
		grafanaAccessor.SetUpdatedTimestamp(&updatedAt)
	}
	grafanaAccessor.SetSlug(rsp.Slug)

	if rsp.Origin != nil {
		originTime := time.UnixMilli(rsp.Origin.Time).UTC()
		grafanaAccessor.SetOriginInfo(&kinds.ResourceOriginInfo{
			Name: rsp.Origin.Source,
			Key:  rsp.Origin.Key,
			// Path: rsp.Origin.Path,
			Timestamp: &originTime,
		})
	}

	if len(rsp.Labels) > 0 {
		metaAccessor.SetLabels(rsp.Labels)
	}

	// TODO fields?

	if len(rsp.Body) > 0 {
		spec := reflect.ValueOf(res).Elem().FieldByName("Spec")
		if spec != (reflect.Value{}) && spec.CanSet() {
			err = json.Unmarshal(rsp.Body, spec.Addr().Interface())
			if err != nil {
				return err
			}
		}
	}

	if len(rsp.Status) > 0 {
		status := reflect.ValueOf(res).Elem().FieldByName("Status")
		if status != (reflect.Value{}) && status.CanSet() {
			err = json.Unmarshal(rsp.Status, status.Addr().Interface())
			if err != nil {
				return err
			}
		}
	}

	fmt.Printf("RESOURCE: %#v\n\n", res)

	return nil
}

func resourceToEntity(key string, res runtime.Object) (*entityStore.Entity, error) {
	metaAccessor, err := meta.Accessor(res)
	if err != nil {
		return nil, err
	}

	fmt.Printf("RESOURCE: %+v\n", res)

	g, err := keyToGRN(key, res.GetObjectKind().GroupVersionKind().Kind)
	if err != nil {
		return nil, err
	}

	grafanaAccessor := kinds.MetaAccessor(metaAccessor)

	rsp := &entityStore.Entity{
		GRN:          g,
		GroupVersion: res.GetObjectKind().GroupVersionKind().Version,
		Key:          key,
		Name:         metaAccessor.GetName(),
		Guid:         string(metaAccessor.GetUID()),
		Version:      metaAccessor.GetResourceVersion(),
		Folder:       grafanaAccessor.GetFolder(),
		CreatedAt:    metaAccessor.GetCreationTimestamp().Time.UnixMilli(),
		CreatedBy:    grafanaAccessor.GetCreatedBy(),
		UpdatedBy:    grafanaAccessor.GetUpdatedBy(),
		Slug:         grafanaAccessor.GetSlug(),
		Origin: &entityStore.EntityOriginInfo{
			Source: grafanaAccessor.GetOriginName(),
			Key:    grafanaAccessor.GetOriginKey(),
			// Path: kinds.GetOriginPath(metaAccessor),
		},
		Labels: metaAccessor.GetLabels(),
	}

	if t := grafanaAccessor.GetUpdatedTimestamp(); t != nil {
		rsp.UpdatedAt = t.UnixMilli()
	}

	if t := grafanaAccessor.GetOriginTimestamp(); t != nil {
		rsp.Origin.Time = t.UnixMilli()
	}

	rsp.Meta, err = json.Marshal(meta.AsPartialObjectMetadata(metaAccessor))
	if err != nil {
		return nil, err
	}

	spec := reflect.ValueOf(res).Elem().FieldByName("Spec")
	if spec != (reflect.Value{}) {
		rsp.Body, err = json.Marshal(spec.Interface())
		if err != nil {
			return nil, err
		}
	}

	status := reflect.ValueOf(res).Elem().FieldByName("Status")
	if status != (reflect.Value{}) {
		rsp.Status, err = json.Marshal(status.Interface())
		if err != nil {
			return nil, err
		}
	}

	fmt.Printf("ENTITY: %+v\n", rsp)
	return rsp, nil
}

func contextWithFakeGrafanaUser(ctx context.Context) (context.Context, error) {
	info, ok := request.UserFrom(ctx)
	if !ok {
		return ctx, fmt.Errorf("could not find k8s user info in context")
	}

	var err error
	user := &user.SignedInUser{
		UserID: -1,
		OrgID:  -1,
		Name:   info.GetName(),
	}
	if user.Name == "system:apiserver" {
		user.OrgID = 1
		user.UserID = 1
	}

	v, ok := info.GetExtra()["user-id"]
	if ok && len(v) > 0 {
		user.UserID, err = strconv.ParseInt(v[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana user id from extras map")
		}
	}
	v, ok = info.GetExtra()["org-id"]
	if ok && len(v) > 0 {
		user.OrgID, err = strconv.ParseInt(v[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana org id from extras map")
		}
	}

	if user.OrgID < 0 || user.UserID < 0 {
		// Aggregated mode.... need to map this to a real user somehow
		user.OrgID = 1
		user.UserID = 1
		// return nil, fmt.Errorf("insufficient information on user context, couldn't determine UserID and OrgID")
	}

	// HACK alert... change to the requested org
	// TODO: should validate that user has access to that org/tenant
	ns, ok := request.NamespaceFrom(ctx)
	if ok && ns != "" {
		nsorg, err := util.NamespaceToOrgID(ns)
		if err != nil {
			return nil, err
		}
		user.OrgID = nsorg
	}

	return appcontext.WithUser(ctx, user), nil
}
