package apistore

import (
	"bytes"
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func logN(n, b float64) float64 {
	return math.Log(n) / math.Log(b)
}

// Slightly modified function from https://github.com/dustin/go-humanize (MIT).
func formatBytes(numBytes int) string {
	base := 1024.0
	sizes := []string{"B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"}
	if numBytes < 10 {
		return fmt.Sprintf("%d B", numBytes)
	}
	e := math.Floor(logN(float64(numBytes), base))
	suffix := sizes[int(e)]
	val := math.Floor(float64(numBytes)/math.Pow(base, e)*10+0.5) / 10
	return fmt.Sprintf("%.1f %s", val, suffix)
}

// Called on create
func (s *Storage) prepareObjectForStorage(ctx context.Context, newObject runtime.Object) ([]byte, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(newObject)
	if err != nil {
		return nil, err
	}
	if obj.GetName() == "" {
		return nil, storage.ErrResourceVersionSetOnCreate
	}
	if obj.GetResourceVersion() != "" {
		return nil, storage.ErrResourceVersionSetOnCreate
	}
	if obj.GetUID() == "" {
		obj.SetUID(types.UID(uuid.NewString()))
	}

	if s.opts.RequireDeprecatedInternalID {
		// nolint:staticcheck
		id := obj.GetDeprecatedInternalID()
		if id < 1 {
			// nolint:staticcheck
			obj.SetDeprecatedInternalID(s.snowflake.Generate().Int64())
		}
	}

	obj.SetGenerateName("") // Clear the random name field
	obj.SetResourceVersion("")
	obj.SetSelfLink("")

	// Read+write will verify that repository format is accurate
	repo, err := obj.GetRepositoryInfo()
	if err != nil {
		return nil, err
	}
	obj.SetRepositoryInfo(repo)
	obj.SetUpdatedBy("")
	obj.SetUpdatedTimestamp(nil)
	obj.SetCreatedBy(user.GetUID())

	var buf bytes.Buffer
	if err = s.codec.Encode(newObject, &buf); err != nil {
		return nil, err
	}
	return s.handleLargeResources(ctx, obj, buf)
}

// Called on update
func (s *Storage) prepareObjectForUpdate(ctx context.Context, updateObject runtime.Object, previousObject runtime.Object) ([]byte, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(updateObject)
	if err != nil {
		return nil, err
	}
	if obj.GetName() == "" {
		return nil, fmt.Errorf("updated object must have a name")
	}

	previous, err := utils.MetaAccessor(previousObject)
	if err != nil {
		return nil, err
	}

	if previous.GetUID() == "" {
		klog.Errorf("object is missing UID: %s, %s", obj.GetGroupVersionKind().String(), obj.GetName())
	} else if obj.GetUID() != previous.GetUID() {
		// Eventually this should be a real error or logged
		// However the dashboard dual write behavior hits this every time, so we will ignore it
		// if obj.GetUID() != "" {
		// 	klog.Errorf("object UID mismatch: %s, was:%s, now: %s", obj.GetGroupVersionKind().String(), previous.GetName(), obj.GetUID())
		// }
		obj.SetUID(previous.GetUID())
	}

	if obj.GetName() != previous.GetName() {
		return nil, fmt.Errorf("name mismatch between existing and updated object")
	}

	obj.SetCreatedBy(previous.GetCreatedBy())
	obj.SetCreationTimestamp(previous.GetCreationTimestamp())
	obj.SetResourceVersion("") // removed from saved JSON because the RV is not yet calculated

	// for dashboards, a mutation hook will set it if it didn't exist on the previous obj
	// avoid setting it back to 0
	previousInternalID := previous.GetDeprecatedInternalID() // nolint:staticcheck
	if previousInternalID != 0 {
		obj.SetDeprecatedInternalID(previousInternalID) // nolint:staticcheck
	}

	// Read+write will verify that origin format is accurate
	repo, err := obj.GetRepositoryInfo()
	if err != nil {
		return nil, err
	}
	obj.SetRepositoryInfo(repo)
	obj.SetUpdatedBy(user.GetUID())
	obj.SetUpdatedTimestampMillis(time.Now().UnixMilli())

	var buf bytes.Buffer
	if err = s.codec.Encode(updateObject, &buf); err != nil {
		return nil, err
	}
	return s.handleLargeResources(ctx, obj, buf)
}

func (s *Storage) handleLargeResources(ctx context.Context, obj utils.GrafanaMetaAccessor, buf bytes.Buffer) ([]byte, error) {
	support := s.opts.LargeObjectSupport
	if support != nil {
		size := buf.Len()
		if size > support.Threshold() {
			if support.MaxSize() > 0 && size > support.MaxSize() {
				return nil, fmt.Errorf("request object is too big (%s > %s)", formatBytes(size), formatBytes(support.MaxSize()))
			}
		}

		key := &resource.ResourceKey{
			Group:     s.gr.Group,
			Resource:  s.gr.Resource,
			Namespace: obj.GetNamespace(),
			Name:      obj.GetName(),
		}

		err := support.Deconstruct(ctx, key, s.store, obj, buf.Bytes())
		if err != nil {
			return nil, err
		}

		buf.Reset()
		orig, ok := obj.GetRuntimeObject()
		if !ok {
			return nil, fmt.Errorf("error using object as runtime object")
		}

		// Now encode the smaller version
		if err = s.codec.Encode(orig, &buf); err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}
