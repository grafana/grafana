package entitybridge

import (
	"errors"
	"io"
	"time"

	grpcCodes "google.golang.org/grpc/codes"
	grpcStatus "google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	entitystore "github.com/grafana/grafana/pkg/services/apiserver/storage/entity"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type decoder struct {
	client entity.EntityStore_WatchClient
}

// Any errors will end the stream
func (d *decoder) next() (*resource.WrittenEvent, error) {
decode:
	for {
		err := d.client.Context().Err()
		if err != nil {
			klog.Errorf("client: context error: %s\n", err)
			return nil, err
		}

		rsp, err := d.client.Recv()
		if errors.Is(err, io.EOF) {
			return nil, err
		}

		if grpcStatus.Code(err) == grpcCodes.Canceled {
			return nil, err
		}

		if err != nil {
			klog.Errorf("client: error receiving result: %s", err)
			return nil, err
		}

		if rsp.Entity == nil {
			klog.Errorf("client: received nil entity\n")
			continue decode
		}

		event := resource.WriteEvent{
			Key: &resource.ResourceKey{
				Group:     rsp.Entity.Namespace,
				Resource:  rsp.Entity.Resource,
				Namespace: rsp.Entity.Namespace,
				Name:      rsp.Entity.Name,
			},
		}

		switch rsp.Entity.Action {
		case entity.Entity_CREATED:
			event.Type = resource.WatchEvent_ADDED
		case entity.Entity_UPDATED:
			event.Type = resource.WatchEvent_MODIFIED
		case entity.Entity_DELETED:
			event.Type = resource.WatchEvent_DELETED
		default:
			klog.Errorf("unsupported action\n")
			continue decode
		}

		// Now decode the bytes into an object
		obj := &unstructured.Unstructured{}
		err = entitystore.EntityToRuntimeObject(rsp.Entity, obj, unstructured.UnstructuredJSONScheme)
		if err != nil {
			klog.Errorf("error decoding entity: %s", err)
			return nil, err
		}

		event.Value, err = obj.MarshalJSON()
		if err != nil {
			return nil, err
		}
		event.Object, err = utils.MetaAccessor(obj)
		if err != nil {
			return nil, err
		}

		// Decode the old value
		if rsp.Previous != nil {
			err = entitystore.EntityToRuntimeObject(rsp.Previous, obj, unstructured.UnstructuredJSONScheme)
			if err != nil {
				klog.Errorf("error decoding entity: %s", err)
				return nil, err
			}
			event.ObjectOld, err = utils.MetaAccessor(obj)
			if err != nil {
				return nil, err
			}
			event.PreviousRV, err = event.ObjectOld.GetResourceVersionInt64()
			if err != nil {
				return nil, err
			}
		}
		return &resource.WrittenEvent{
			ResourceVersion: rsp.Entity.ResourceVersion,
			Timestamp:       time.Now().UnixMilli(),
			WriteEvent:      event,
		}, nil
	}
}

func (d *decoder) close() {
	err := d.client.CloseSend()
	if err != nil {
		klog.Errorf("error closing watch stream: %s", err)
	}
}
