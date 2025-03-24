package apistore

import (
	"context"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"
	"k8s.io/apimachinery/pkg/api/apitesting"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var scheme = runtime.NewScheme()
var codecs = serializer.NewCodecFactory(scheme)

func TestPrepareObjectForStorage(t *testing.T) {
	_ = v0alpha1.AddToScheme(scheme)
	node, err := snowflake.NewNode(rand.Int63n(1024))
	require.NoError(t, err)
	s := &Storage{
		codec:     apitesting.TestCodec(codecs, v0alpha1.DashboardResourceInfo.GroupVersion()),
		snowflake: node,
		opts: StorageOptions{
			EnableFolderSupport: true,
			LargeObjectSupport:  nil,
		},
	}

	ctx := authtypes.WithAuthInfo(context.Background(),
		&identity.StaticRequester{UserID: 1, UserUID: "user-uid", Type: authtypes.TypeUser},
	)

	t.Run("Error getting auth info from context", func(t *testing.T) {
		_, err := s.prepareObjectForStorage(context.Background(), nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing auth info")
	})

	t.Run("Error on missing name", func(t *testing.T) {
		dashboard := v0alpha1.Dashboard{}
		_, err := s.prepareObjectForStorage(ctx, dashboard.DeepCopyObject())
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing name")
	})

	t.Run("Error on non-empty resource version", func(t *testing.T) {
		dashboard := v0alpha1.Dashboard{}
		dashboard.Name = "test-name"
		dashboard.ResourceVersion = "123"
		_, err := s.prepareObjectForStorage(ctx, dashboard.DeepCopyObject())
		require.Error(t, err)
		require.Equal(t, storage.ErrResourceVersionSetOnCreate, err)
	})

	t.Run("Generate UID and leave deprecated ID empty, if not required", func(t *testing.T) {
		dashboard := v0alpha1.Dashboard{}
		dashboard.Name = "test-name"

		encodedData, err := s.prepareObjectForStorage(ctx, dashboard.DeepCopyObject())
		require.NoError(t, err)

		newObject, _, err := s.codec.Decode(encodedData, nil, &v0alpha1.Dashboard{})
		require.NoError(t, err)
		obj, err := utils.MetaAccessor(newObject)
		require.NoError(t, err)
		require.NotEmpty(t, obj.GetUID(), "")
		require.Empty(t, obj.GetDeprecatedInternalID()) // nolint:staticcheck
		require.Empty(t, obj.GetGenerateName())
		require.Empty(t, obj.GetResourceVersion())
		require.Empty(t, obj.GetSelfLink())
		require.Empty(t, obj.GetUpdatedBy())
		require.Equal(t, obj.GetCreatedBy(), "user:user-uid")
		updatedTS, err := obj.GetUpdatedTimestamp()
		require.NoError(t, err)
		require.Empty(t, updatedTS)
	})

	t.Run("Should keep manager info", func(t *testing.T) {
		dashboard := v0alpha1.Dashboard{}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		now := time.Now()
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "test-repo",
		})
		meta.SetSourceProperties(utils.SourceProperties{
			Path:            "test/path",
			Checksum:        "hash",
			TimestampMillis: now.UnixMilli(),
		})

		encodedData, err := s.prepareObjectForStorage(ctx, obj)
		require.NoError(t, err)

		newObject, _, err := s.codec.Decode(encodedData, nil, &v0alpha1.Dashboard{})
		require.NoError(t, err)
		meta, err = utils.MetaAccessor(newObject)
		require.NoError(t, err)

		m, ok := meta.GetManagerProperties()
		require.True(t, ok)
		s, ok := meta.GetSourceProperties()
		require.True(t, ok)

		require.Equal(t, m.Identity, "test-repo")
		require.Equal(t, s.Checksum, "hash")
		require.Equal(t, s.Path, "test/path")
		require.Equal(t, s.TimestampMillis, now.UnixMilli())
	})

	t.Run("Update should manage incrementing generation and metadata", func(t *testing.T) {
		dashboard := v0alpha1.Dashboard{}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		meta, err := utils.MetaAccessor(obj)
		meta.SetFolder("aaa")
		require.NoError(t, err)

		encodedData, err := s.prepareObjectForStorage(ctx, obj)
		require.NoError(t, err)

		insertedObject, _, err := s.codec.Decode(encodedData, nil, &v0alpha1.Dashboard{})
		require.NoError(t, err)
		meta, err = utils.MetaAccessor(insertedObject)
		require.NoError(t, err)
		require.Equal(t, int64(1), meta.GetGeneration())
		require.Equal(t, "user:user-uid", meta.GetCreatedBy())
		require.Equal(t, "", meta.GetUpdatedBy()) // empty
		ts, err := meta.GetUpdatedTimestamp()
		require.NoError(t, err)
		require.Nil(t, ts)

		// Change the user... and only update metadata
		ctx = authtypes.WithAuthInfo(context.Background(),
			&identity.StaticRequester{UserID: 1, UserUID: "user2", Type: authtypes.TypeUser},
		)

		// Change the status... but generation is the same
		updatedObject := insertedObject.DeepCopyObject()
		meta, err = utils.MetaAccessor(updatedObject)
		require.NoError(t, err)
		err = meta.SetStatus(v0alpha1.DashboardStatus{
			Conversion: &v0alpha1.DashboardConversionStatus{
				Failed: true,
				Error:  "test",
			},
		})
		require.NoError(t, err)
		meta.SetGeneration(123) // will be removed

		// Update status without changing generation or update metadata
		_, err = s.prepareObjectForUpdate(ctx, updatedObject, insertedObject)
		require.NoError(t, err)
		require.Equal(t, "", meta.GetUpdatedBy())
		require.Equal(t, int64(1), meta.GetGeneration())

		// Change the folder -- the generation should increase and the updatedBy metadata
		dashboard2 := &v0alpha1.Dashboard{ObjectMeta: v1.ObjectMeta{
			Name: dashboard.Name,
		}} // TODO... deep copy, See: https://github.com/grafana/grafana/pull/102258
		meta2, err := utils.MetaAccessor(dashboard2)
		require.NoError(t, err)
		meta2.SetFolder("xyz") // will bump generation
		_, err = s.prepareObjectForUpdate(ctx, dashboard2, updatedObject)
		require.NoError(t, err)
		require.Equal(t, "user:user2", meta2.GetUpdatedBy())
		require.Equal(t, int64(2), meta2.GetGeneration())
	})

	s.opts.RequireDeprecatedInternalID = true
	t.Run("Should generate internal id", func(t *testing.T) {
		dashboard := v0alpha1.Dashboard{}
		dashboard.Name = "test-name"

		encodedData, err := s.prepareObjectForStorage(ctx, dashboard.DeepCopyObject())
		require.NoError(t, err)
		newObject, _, err := s.codec.Decode(encodedData, nil, &v0alpha1.Dashboard{})
		require.NoError(t, err)
		obj, err := utils.MetaAccessor(newObject)
		require.NoError(t, err)
		require.NotEmpty(t, obj.GetDeprecatedInternalID()) // nolint:staticcheck
		// must be less than the max number value in javascript to avoid precision loss
		require.LessOrEqual(t, obj.GetDeprecatedInternalID(), int64(9007199254740991)) // nolint:staticcheck
	})

	t.Run("Should use deprecated ID if given it", func(t *testing.T) {
		dashboard := v0alpha1.Dashboard{}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetDeprecatedInternalID(1) // nolint:staticcheck

		encodedData, err := s.prepareObjectForStorage(ctx, obj)
		require.NoError(t, err)
		newObject, _, err := s.codec.Decode(encodedData, nil, &v0alpha1.Dashboard{})
		require.NoError(t, err)
		meta, err = utils.MetaAccessor(newObject)
		require.NoError(t, err)
		require.Equal(t, meta.GetDeprecatedInternalID(), int64(1)) // nolint:staticcheck
	})

	t.Run("calculate generation", func(t *testing.T) {
		dash := &v0alpha1.Dashboard{
			ObjectMeta: v1.ObjectMeta{
				Name: "test",
			},
			Spec: v0alpha1.DashboardSpec{
				Object: map[string]interface{}{
					"hello": "world",
				},
			},
		}
		out := getPreparedObject(t, ctx, s, dash, nil)
		require.Equal(t, int64(1), out.GetGeneration())
		require.NotEmpty(t, out.GetAnnotation(utils.AnnoKeyCreatedBy))
		require.Equal(t, "", out.GetAnnotation(utils.AnnoKeyUpdatedBy))
		require.Equal(t, "", out.GetAnnotation(utils.AnnoKeyUpdatedTimestamp))

		t.Run("increment when the spec changes", func(t *testing.T) {
			b := dash.DeepCopy()
			b.Spec.Object["x"] = "y"
			out = getPreparedObject(t, ctx, s, b, dash)
			require.Equal(t, int64(2), out.GetGeneration())
			require.NotEmpty(t, out.GetAnnotation(utils.AnnoKeyUpdatedBy))
			require.NotEmpty(t, out.GetAnnotation(utils.AnnoKeyUpdatedTimestamp))
		})

		t.Run("increment when the folder changes", func(t *testing.T) {
			b := dash.DeepCopy()
			b.Annotations = map[string]string{
				utils.AnnoKeyFolder: "abc",
			}
			out = getPreparedObject(t, ctx, s, b, dash)
			require.Equal(t, int64(2), out.GetGeneration())
		})

		t.Run("increment when deleted", func(t *testing.T) {
			now := v1.Now()
			b := dash.DeepCopy()
			b.DeletionTimestamp = &now
			out = getPreparedObject(t, ctx, s, b, dash)
			require.Equal(t, int64(2), out.GetGeneration())
		})

		t.Run("keep when status, labels, or annotations change", func(t *testing.T) {
			b := dash.DeepCopy()
			b.Annotations = map[string]string{
				"x": "hello",
			}
			b.Labels = map[string]string{
				"a": "b",
			}
			b.Status = v0alpha1.DashboardStatus{
				Conversion: &v0alpha1.DashboardConversionStatus{
					Failed: true,
				},
			}
			out = getPreparedObject(t, ctx, s, b, dash)
			require.Equal(t, int64(1), out.GetGeneration()) // still 1
		})
	})
}

func getPreparedObject(t *testing.T, ctx context.Context, s *Storage, obj runtime.Object, old runtime.Object) utils.GrafanaMetaAccessor {
	t.Helper()

	var raw []byte
	var err error

	if old == nil {
		raw, err = s.prepareObjectForStorage(ctx, obj)
	} else {
		raw, err = s.prepareObjectForUpdate(ctx, obj, old)
	}
	require.NoError(t, err)

	out := &unstructured.Unstructured{}
	err = out.UnmarshalJSON(raw)
	require.NoError(t, err)

	meta, err := utils.MetaAccessor(out)
	require.NoError(t, err)
	return meta
}
