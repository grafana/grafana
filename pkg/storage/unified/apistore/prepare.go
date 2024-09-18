package apistore

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/storage"
)

// Called on create
func (s *Storage) prepareObjectForStorage(ctx context.Context, newObject runtime.Object) ([]byte, map[string]*resource.SecureValue, error) {
	user, ok := claims.From(ctx)
	if !ok {
		return nil, nil, fmt.Errorf("no user claims found in request")
	}

	obj, err := utils.MetaAccessor(newObject)
	if err != nil {
		return nil, nil, err
	}
	if obj.GetName() == "" {
		return nil, nil, fmt.Errorf("new object must have a name")
	}
	if obj.GetResourceVersion() != "" {
		return nil, nil, storage.ErrResourceVersionSetOnCreate
	}
	obj.SetGenerateName("") // Clear the random name field
	obj.SetResourceVersion("")
	obj.SetSelfLink("")

	// Read+write will verify that origin format is accurate
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, nil, err
	}
	obj.SetOriginInfo(origin)
	obj.SetUpdatedBy("")
	obj.SetUpdatedTimestamp(nil)
	obj.SetCreatedBy(user.GetUID())

	// Secure fields exist
	secure, err := s.updateSecureFields(obj)
	if err != nil {
		return nil, nil, err
	}

	var buf bytes.Buffer
	err = s.codec.Encode(newObject, &buf)
	if err != nil {
		return nil, nil, err
	}
	return buf.Bytes(), secure, nil
}

// Called on update
func (s *Storage) prepareObjectForUpdate(ctx context.Context, updateObject runtime.Object, previousObject runtime.Object) ([]byte, map[string]*resource.SecureValue, error) {
	user, ok := claims.From(ctx)
	if !ok {
		return nil, nil, fmt.Errorf("no user claims found in request")
	}

	obj, err := utils.MetaAccessor(updateObject)
	if err != nil {
		return nil, nil, err
	}
	if obj.GetName() == "" {
		return nil, nil, fmt.Errorf("updated object must have a name")
	}

	previous, err := utils.MetaAccessor(previousObject)
	if err != nil {
		return nil, nil, err
	}
	obj.SetUID(previous.GetUID())
	obj.SetCreatedBy(previous.GetCreatedBy())
	obj.SetCreationTimestamp(previous.GetCreationTimestamp())

	// Read+write will verify that origin format is accurate
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, nil, err
	}
	obj.SetOriginInfo(origin)
	obj.SetUpdatedBy(user.GetUID())
	obj.SetUpdatedTimestampMillis(time.Now().UnixMilli())

	// Secure fields exist
	secure, err := s.updateSecureFields(obj)
	if err != nil {
		return nil, nil, err
	}

	var buf bytes.Buffer
	err = s.codec.Encode(updateObject, &buf)
	if err != nil {
		return nil, nil, err
	}
	return buf.Bytes(), secure, nil
}

// Called on update
func (s *Storage) updateSecureFields(obj utils.GrafanaMetaAccessor) (map[string]*resource.SecureValue, error) {
	// Secure fields exist
	secure, ok := obj.GetSecureValues()
	if !ok || len(secure) < 1 {
		return nil, nil
	}

	fields := make(map[string]*resource.SecureValue, len(secure))
	for k, v := range secure {
		if !v.IsValidForWrite() {
			// fmt.Printf("updateSecureFields error: %s=%+v\n", k, v)
			return nil, fmt.Errorf("unable to write secure value: %s", k)
		}

		// Move the raw values in the resource to the secure value section
		// and replace the resource payload with a new GUID
		sv := &resource.SecureValue{Guid: v.GUID}
		if v.GUID == "" {
			sv.Guid = uuid.NewString()
			sv.Value = v.Value
			sv.Refid = v.Ref

			v.GUID = sv.Guid
			v.Value = ""
			v.Ref = ""

			// Update the value
			err := obj.SetSecureValue(k, v)
			if err != nil {
				return nil, err
			}
		}
		fields[k] = sv
	}

	// Make sure the kubectl last applied does not include secret values
	if len(fields) > 0 {
		// Check if the managed fields includes `f:secure`
		for _, v := range obj.GetManagedFields() {
			if v.FieldsV1 == nil {
				continue
			}
			if bytes.Contains(v.FieldsV1.Raw, []byte(`"f:secure":`)) {
				raw := map[string]any{}
				err := json.Unmarshal(v.FieldsV1.Raw, &raw)
				if err != nil {
					return nil, err
				}
				// Or replace the value/ref with GUID???
				delete(raw, "f:secure")
				v.FieldsV1.Raw, err = json.Marshal(raw)
				if err != nil {
					return nil, err
				}
			}
		}

		lastapplied := obj.GetAnnotations()["kubectl.kubernetes.io/last-applied-configuration"]
		if lastapplied != "" {
			cfg := unstructured.Unstructured{}
			err := cfg.UnmarshalJSON([]byte(lastapplied))
			if err != nil {
				return nil, err
			}
			delete(cfg.Object, "secure")
			lastappliedbytes, err := cfg.MarshalJSON()
			if err != nil {
				return nil, err
			}
			obj.SetAnnotation("kubectl.kubernetes.io/last-applied-configuration", string(lastappliedbytes))
		}
	}

	return fields, nil
}
