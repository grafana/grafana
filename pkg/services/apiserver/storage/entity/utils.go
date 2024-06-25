package entity

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	entityStore "github.com/grafana/grafana/pkg/services/store/entity"
)

func EntityToRuntimeObject(rsp *entityStore.Entity, res runtime.Object, codec runtime.Codec) error {
	var err error

	// Read the body first -- it includes old resourceVersion!
	if len(rsp.Body) > 0 {
		decoded, _, err := codec.Decode(rsp.Body, &schema.GroupVersionKind{Group: rsp.Group, Version: rsp.GroupVersion}, res)
		if err != nil {
			return err
		}
		res = decoded
	}

	metaAccessor, err := meta.Accessor(res)
	if err != nil {
		return err
	}

	if len(rsp.Meta) > 0 {
		err = json.Unmarshal(rsp.Meta, res)
		if err != nil {
			return err
		}
	}

	metaAccessor.SetName(rsp.Name)
	metaAccessor.SetNamespace(rsp.Namespace)
	metaAccessor.SetUID(types.UID(rsp.Guid))
	metaAccessor.SetResourceVersion(fmt.Sprintf("%d", rsp.ResourceVersion))
	metaAccessor.SetCreationTimestamp(metav1.Unix(rsp.CreatedAt/1000, rsp.CreatedAt%1000*1000000))

	grafanaAccessor, err := utils.MetaAccessor(metaAccessor)
	if err != nil {
		return err
	}

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
		grafanaAccessor.SetOriginInfo(&utils.ResourceOriginInfo{
			Name: rsp.Origin.Source,
			Path: rsp.Origin.Key, // Using "key" in the
			// Path: rsp.Origin.Path,
			Timestamp: &originTime,
		})
	}

	if len(rsp.Labels) > 0 {
		metaAccessor.SetLabels(rsp.Labels)
	}

	// TODO fields?

	if len(rsp.Status) > 0 {
		status := reflect.ValueOf(res).Elem().FieldByName("Status")
		if status != (reflect.Value{}) && status.CanSet() {
			err = json.Unmarshal(rsp.Status, status.Addr().Interface())
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func resourceToEntity(res runtime.Object, k grafanaregistry.Key, codec runtime.Codec) (*entityStore.Entity, error) {
	metaAccessor, err := meta.Accessor(res)
	if err != nil {
		return nil, err
	}

	grafanaAccessor, err := utils.MetaAccessor(metaAccessor)
	if err != nil {
		return nil, err
	}
	rv, _ := strconv.ParseInt(metaAccessor.GetResourceVersion(), 10, 64)

	// add the object's name to the provided key
	k.Name = metaAccessor.GetName()

	rsp := &entityStore.Entity{
		Group:           k.Group,
		GroupVersion:    res.GetObjectKind().GroupVersionKind().Version,
		Resource:        k.Resource,
		Namespace:       k.Namespace,
		Key:             k.String(),
		Name:            k.Name,
		Guid:            string(metaAccessor.GetUID()),
		ResourceVersion: rv,
		Folder:          grafanaAccessor.GetFolder(),
		CreatedAt:       metaAccessor.GetCreationTimestamp().Time.UnixMilli(),
		CreatedBy:       grafanaAccessor.GetCreatedBy(),
		UpdatedBy:       grafanaAccessor.GetUpdatedBy(),
		Slug:            grafanaAccessor.GetSlug(),
		Title:           grafanaAccessor.FindTitle(metaAccessor.GetName()),
		Origin: &entityStore.EntityOriginInfo{
			Source: grafanaAccessor.GetOriginName(),
			// Deprecated: Keeping "key" in the protobuf to avoid migrations while a bigger one is in place
			Key: grafanaAccessor.GetOriginPath(),
		},
		Labels: metaAccessor.GetLabels(),
	}

	t, err := grafanaAccessor.GetUpdatedTimestamp()
	if err != nil {
		return nil, err
	}
	if t != nil {
		rsp.UpdatedAt = t.UnixMilli()
	}

	t, err = grafanaAccessor.GetOriginTimestamp()
	if err != nil {
		return nil, err
	}
	if t != nil {
		rsp.Origin.Time = t.UnixMilli()
	}

	rsp.Meta, err = json.Marshal(meta.AsPartialObjectMetadata(metaAccessor))
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	err = codec.Encode(res, &buf)
	if err != nil {
		return nil, err
	}
	rsp.Body = buf.Bytes()

	status := reflect.ValueOf(res).Elem().FieldByName("Status")
	if status != (reflect.Value{}) {
		rsp.Status, err = json.Marshal(status.Interface())
		if err != nil {
			return nil, err
		}
	}

	return rsp, nil
}
