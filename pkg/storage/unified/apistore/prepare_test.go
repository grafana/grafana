package apistore

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/api/apitesting"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/client-go/dynamic"

	authlib "github.com/grafana/authlib/types"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var rtscheme = runtime.NewScheme()
var rtcodecs = serializer.NewCodecFactory(rtscheme)

func TestPrepareObjectForStorage(t *testing.T) {
	_ = dashv1.AddToScheme(rtscheme)
	node, err := snowflake.NewNode(rand.Int64N(1024))
	require.NoError(t, err)
	s := &Storage{
		gr:        dashv1.DashboardResourceInfo.GroupResource(),
		codec:     apitesting.TestCodec(rtcodecs, dashv1.DashboardResourceInfo.GroupVersion()),
		snowflake: node,
		opts: StorageOptions{
			Scheme:              rtscheme,
			EnableFolderSupport: true,
			MaximumNameLength:   100,
		},
	}

	ctx := authlib.WithAuthInfo(context.Background(),
		&identity.StaticRequester{UserID: 1, UserUID: "user-uid", Type: authlib.TypeUser},
	)

	t.Run("Error getting auth info from context", func(t *testing.T) {
		_, err := s.prepareObjectForStorage(context.Background(), nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing auth info")
	})

	t.Run("Error on missing name", func(t *testing.T) {
		dashboard := &dashv1.Dashboard{}
		_, err := s.prepareObjectForStorage(ctx, dashboard)
		require.Error(t, err)
		require.ErrorContains(t, err, "missing name")
	})

	t.Run("name is too long", func(t *testing.T) {
		dashboard := &dashv1.Dashboard{}
		dashboard.Name = strings.Repeat("a", 120)
		_, err := s.prepareObjectForStorage(ctx, dashboard)
		require.Error(t, err)
		require.ErrorContains(t, err, "name exceeds maximum length")
	})

	t.Run("Error on non-empty resource version", func(t *testing.T) {
		dashboard := dashv1.Dashboard{}
		dashboard.Name = "test-name"
		dashboard.ResourceVersion = "123"
		_, err := s.prepareObjectForStorage(ctx, dashboard.DeepCopyObject())
		require.Error(t, err)
		require.Equal(t, storage.ErrResourceVersionSetOnCreate, err)
	})

	t.Run("Generate UID and leave deprecated ID empty, if not required", func(t *testing.T) {
		dashboard := dashv1.Dashboard{}
		dashboard.Name = "test-name"

		v, err := s.prepareObjectForStorage(ctx, dashboard.DeepCopyObject())
		require.NoError(t, err)

		newObject, _, err := s.codec.Decode(v.raw.Bytes(), nil, &dashv1.Dashboard{})
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
		ctx, _, err := identity.WithProvisioningIdentity(ctx, "default")
		require.NoError(t, err)

		dashboard := dashv1.Dashboard{}
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

		v, err := s.prepareObjectForStorage(ctx, obj)
		require.NoError(t, err)

		newObject, _, err := s.codec.Decode(v.raw.Bytes(), nil, &dashv1.Dashboard{})
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
		dashboard := dashv1.Dashboard{}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		meta, err := utils.MetaAccessor(obj)
		meta.SetFolder("aaa")
		require.NoError(t, err)

		v, err := s.prepareObjectForStorage(ctx, obj)
		require.NoError(t, err)

		insertedObject, _, err := s.codec.Decode(v.raw.Bytes(), nil, &dashv1.Dashboard{})
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
		ctx = authlib.WithAuthInfo(context.Background(),
			&identity.StaticRequester{UserID: 1, UserUID: "user2", Type: authlib.TypeUser},
		)

		// Change the status... but generation is the same
		updatedObject := insertedObject.DeepCopyObject()
		meta, err = utils.MetaAccessor(updatedObject)
		require.NoError(t, err)
		err = meta.SetStatus(dashv1.DashboardStatus{
			Conversion: &dashv1.DashboardConversionStatus{
				Failed: true,
				Error:  new("test"),
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
		dashboard2 := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{
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

	t.Run("Update can not change the deprecated internal ID", func(t *testing.T) {
		// The previously stored object owns internal ID 50
		previous := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "test-name"}}
		prevMeta, err := utils.MetaAccessor(previous)
		require.NoError(t, err)
		prevMeta.SetDeprecatedInternalID(50) // nolint:staticcheck

		assertStoredID := func(t *testing.T, updated *dashv1.Dashboard) {
			t.Helper()
			v, err := s.prepareObjectForUpdate(ctx, updated, previous)
			require.NoError(t, err)
			stored, _, err := s.codec.Decode(v.raw.Bytes(), nil, &dashv1.Dashboard{})
			require.NoError(t, err)
			storedMeta, err := utils.MetaAccessor(stored)
			require.NoError(t, err)
			// The update is ignored: the internal ID stays pinned to the previous value
			require.Equal(t, int64(50), storedMeta.GetDeprecatedInternalID()) // nolint:staticcheck
		}

		// Attempting to change it to a different value is ignored
		changed := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "test-name"}}
		changedMeta, err := utils.MetaAccessor(changed)
		require.NoError(t, err)
		changedMeta.SetDeprecatedInternalID(999) // nolint:staticcheck
		assertStoredID(t, changed)

		// Attempting to clear it is also ignored
		cleared := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "test-name"}}
		assertStoredID(t, cleared)
	})

	t.Run("Update should skip incrementing generation when content is unchanged", func(t *testing.T) {
		dashboard := dashv1.Dashboard{
			ObjectMeta: v1.ObjectMeta{
				Name:       "test",
				Generation: 123,
				Annotations: map[string]string{
					"A":                           "B",
					utils.AnnoKeyUpdatedTimestamp: "2025-12-17T01:01:00Z",
				},
				UID: "XXX",
			},
			Spec: v0alpha1.Unstructured{
				Object: map[string]any{
					"hello": "world",
				},
			},
		}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		tmp, err := utils.MetaAccessor(obj)
		tmp.SetGeneration(2)
		tmp.SetUpdatedTimestampMillis(12345)
		require.NoError(t, err)

		v, err := s.prepareObjectForUpdate(ctx, obj, &dashboard)
		require.NoError(t, err)
		require.False(t, v.hasChanged, "no changes")

		out := &unstructured.Unstructured{}
		err = json.Unmarshal(v.raw.Bytes(), out)
		require.NoError(t, err)

		require.Equal(t, int64(123), tmp.GetGeneration())
		require.Equal(t, "2025-12-17T01:01:00Z", tmp.GetAnnotation(utils.AnnoKeyUpdatedTimestamp))
	})

	s.opts.DeprecatedInternalID = DeprecatedID_Required
	s.opts.Index = &fakeSearchIndex{inUse: map[string]bool{"100": true}}

	t.Run("Should generate internal id", func(t *testing.T) {
		dashboard := dashv1.Dashboard{}
		dashboard.Name = "test-name"

		v, err := s.prepareObjectForStorage(ctx, dashboard.DeepCopyObject())
		require.NoError(t, err)
		newObject, _, err := s.codec.Decode(v.raw.Bytes(), nil, &dashv1.Dashboard{})
		require.NoError(t, err)
		obj, err := utils.MetaAccessor(newObject)
		require.NoError(t, err)
		require.NotEmpty(t, obj.GetDeprecatedInternalID()) // nolint:staticcheck
		// must be less than the max number value in javascript to avoid precision loss
		require.LessOrEqual(t, obj.GetDeprecatedInternalID(), int64(9007199254740991)) // nolint:staticcheck
	})

	t.Run("Should use deprecated ID if given it", func(t *testing.T) {
		dashboard := dashv1.Dashboard{}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetDeprecatedInternalID(1) // nolint:staticcheck

		v, err := s.prepareObjectForStorage(ctx, obj)
		require.NoError(t, err)
		newObject, _, err := s.codec.Decode(v.raw.Bytes(), nil, &dashv1.Dashboard{})
		require.NoError(t, err)
		meta, err = utils.MetaAccessor(newObject)
		require.NoError(t, err)
		require.Equal(t, meta.GetDeprecatedInternalID(), int64(1)) // nolint:staticcheck
	})

	t.Run("Should fail if deprecated ID if already in use", func(t *testing.T) {
		dashboard := dashv1.Dashboard{}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetDeprecatedInternalID(100) // nolint:staticcheck

		_, err = s.prepareObjectForStorage(ctx, obj)
		require.True(t, apierrors.IsConflict(err))
	})

	t.Run("Should remove grant permissions annotation", func(t *testing.T) {
		dashboard := dashv1.Dashboard{}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetAnnotation(utils.AnnoKeyGrantPermissions, "default")

		v, err := s.prepareObjectForStorage(ctx, obj)
		require.NoError(t, err)
		newObject, _, err := s.codec.Decode(v.raw.Bytes(), nil, &dashv1.Dashboard{})
		require.NoError(t, err)
		meta, err = utils.MetaAccessor(newObject)
		require.NoError(t, err)
		require.Empty(t, meta.GetAnnotation(utils.AnnoKeyGrantPermissions))
		require.Equal(t, v.grantPermissions, "default")
	})

	t.Run("calculate generation", func(t *testing.T) {
		dash := &dashv1.Dashboard{
			ObjectMeta: v1.ObjectMeta{
				Name: "test",
			},
			Spec: dashv1.DashboardSpec{
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
			b.Status = dashv1.DashboardStatus{
				Conversion: &dashv1.DashboardConversionStatus{
					Failed: true,
				},
			}
			out = getPreparedObject(t, ctx, s, b, dash)
			require.Equal(t, int64(1), out.GetGeneration()) // still 1
		})
	})

	t.Run("should fail invalid input", func(t *testing.T) {
		_, err := s.prepareObjectForStorage(context.Background(), &dashv1.Dashboard{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing auth info")

		_, err = s.prepareObjectForUpdate(context.Background(), &dashv1.Dashboard{}, &dashv1.Dashboard{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing auth info")

		_, err = s.prepareObjectForStorage(ctx, &dashv1.Dashboard{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing name")

		_, err = s.prepareObjectForUpdate(ctx, &dashv1.Dashboard{}, &dashv1.Dashboard{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "updated object must have a name")

		_, err = s.prepareObjectForUpdate(ctx, &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{
			Name: "test-name",
		}}, &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{
			Name: "not-the-same-name",
		}})
		require.Error(t, err)
		require.Contains(t, err.Error(), "name mismatch between")

		_, err = s.prepareObjectForStorage(ctx, &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{
			Name:            "test-name",
			ResourceVersion: "123", // RV must not be set
		}})
		require.Error(t, err)
		require.Equal(t, storage.ErrResourceVersionSetOnCreate, err)
	})
}

func getPreparedObject(t *testing.T, ctx context.Context, s *Storage, obj runtime.Object, old runtime.Object) utils.GrafanaMetaAccessor {
	t.Helper()

	var v objectForStorage
	var err error

	if old == nil {
		v, err = s.prepareObjectForStorage(ctx, obj)
	} else {
		v, err = s.prepareObjectForUpdate(ctx, obj, old)
	}
	require.NoError(t, err)

	out := &unstructured.Unstructured{}
	err = out.UnmarshalJSON(v.raw.Bytes())
	require.NoError(t, err)

	meta, err := utils.MetaAccessor(out)
	require.NoError(t, err)
	return meta
}

func failingDynClient(err error) func(context.Context) (dynamic.Interface, error) {
	return func(context.Context) (dynamic.Interface, error) { return nil, err }
}

func TestEnsureRepoManagedByParentFolder(t *testing.T) {
	makeDashboard := func(t *testing.T, folder string, mgr *utils.ManagerProperties) utils.GrafanaMetaAccessor {
		t.Helper()
		obj := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "test-dash", Namespace: "default"}}
		acc, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		if folder != "" {
			acc.SetFolder(folder)
		}
		if mgr != nil {
			acc.SetManagerProperties(*mgr)
		}
		return acc
	}

	t.Run("skips when folder support is disabled", func(t *testing.T) {
		s := &Storage{opts: StorageOptions{EnableFolderSupport: false}}
		obj := makeDashboard(t, "some-folder", nil)
		require.NoError(t, s.ensureRepoManagedByParentFolder(context.Background(), obj))
	})

	t.Run("skips when folder annotation is empty", func(t *testing.T) {
		s := &Storage{opts: StorageOptions{EnableFolderSupport: true}}
		obj := makeDashboard(t, "", nil)
		require.NoError(t, s.ensureRepoManagedByParentFolder(context.Background(), obj))
	})

	t.Run("skips when getDynClient is nil", func(t *testing.T) {
		s := &Storage{opts: StorageOptions{EnableFolderSupport: true}}
		obj := makeDashboard(t, "some-folder", nil)
		require.NoError(t, s.ensureRepoManagedByParentFolder(context.Background(), obj))
	})

	t.Run("returns error when folder read fails", func(t *testing.T) {
		s := &Storage{
			opts:         StorageOptions{EnableFolderSupport: true},
			getDynClient: failingDynClient(errors.New("rest config unavailable")),
		}
		obj := makeDashboard(t, "some-folder", nil)
		err := s.ensureRepoManagedByParentFolder(context.Background(), obj)
		require.Error(t, err)
		require.ErrorContains(t, err, "rest config unavailable")
	})

	t.Run("create: dashboard in folder works when getDynClient is nil", func(t *testing.T) {
		_ = dashv1.AddToScheme(rtscheme)
		node, err := snowflake.NewNode(rand.Int64N(1024))
		require.NoError(t, err)

		s := &Storage{
			gr:        dashv1.DashboardResourceInfo.GroupResource(),
			codec:     apitesting.TestCodec(rtcodecs, dashv1.DashboardResourceInfo.GroupVersion()),
			snowflake: node,
			opts: StorageOptions{
				Scheme:              rtscheme,
				EnableFolderSupport: true,
			},
		}

		ctx := authlib.WithAuthInfo(context.Background(),
			&identity.StaticRequester{UserID: 1, UserUID: "u1", Type: authlib.TypeUser},
		)

		dash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "dash-in-folder"}}
		meta, err := utils.MetaAccessor(dash)
		require.NoError(t, err)
		meta.SetFolder("my-folder")

		_, err = s.prepareObjectForStorage(ctx, dash)
		require.NoError(t, err, "create should succeed when getDynClient is nil")
	})

	t.Run("create: fails when folder read fails", func(t *testing.T) {
		_ = dashv1.AddToScheme(rtscheme)
		node, err := snowflake.NewNode(rand.Int64N(1024))
		require.NoError(t, err)

		s := &Storage{
			gr:           dashv1.DashboardResourceInfo.GroupResource(),
			codec:        apitesting.TestCodec(rtcodecs, dashv1.DashboardResourceInfo.GroupVersion()),
			snowflake:    node,
			getDynClient: failingDynClient(errors.New("no config")),
			opts: StorageOptions{
				Scheme:              rtscheme,
				EnableFolderSupport: true,
			},
		}

		ctx := authlib.WithAuthInfo(context.Background(),
			&identity.StaticRequester{UserID: 1, UserUID: "u1", Type: authlib.TypeUser},
		)

		dash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "dash-in-folder"}}
		meta, err := utils.MetaAccessor(dash)
		require.NoError(t, err)
		meta.SetFolder("my-folder")

		_, err = s.prepareObjectForStorage(ctx, dash)
		require.Error(t, err)
		require.ErrorContains(t, err, "no config")
	})

	t.Run("update: manager removal in same folder triggers check", func(t *testing.T) {
		_ = dashv1.AddToScheme(rtscheme)
		node, err := snowflake.NewNode(rand.Int64N(1024))
		require.NoError(t, err)

		s := &Storage{
			gr:           dashv1.DashboardResourceInfo.GroupResource(),
			codec:        apitesting.TestCodec(rtcodecs, dashv1.DashboardResourceInfo.GroupVersion()),
			snowflake:    node,
			getDynClient: failingDynClient(errors.New("no config")),
			opts: StorageOptions{
				Scheme:              rtscheme,
				EnableFolderSupport: true,
			},
		}

		ctx := authlib.WithAuthInfo(context.Background(),
			&identity.StaticRequester{UserID: 1, UserUID: "u1", Type: authlib.TypeUser},
		)

		oldDash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{
			Name: "dash",
			Annotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
				utils.AnnoKeyManagerIdentity: "my-kubectl",
			},
		}}
		oldMeta, err := utils.MetaAccessor(oldDash)
		require.NoError(t, err)
		oldMeta.SetFolder("same-folder")

		newDash := oldDash.DeepCopy()
		newMeta, err := utils.MetaAccessor(newDash)
		require.NoError(t, err)
		newMeta.SetAnnotation(utils.AnnoKeyManagerKind, "")
		newMeta.SetAnnotation(utils.AnnoKeyManagerIdentity, "")

		_, err = s.prepareObjectForUpdate(ctx, newDash, oldDash)
		require.Error(t, err, "manager removal in managed folder should be blocked")
		require.ErrorContains(t, err, "no config")
	})

	t.Run("update: manager addition in same folder triggers check", func(t *testing.T) {
		_ = dashv1.AddToScheme(rtscheme)
		node, err := snowflake.NewNode(rand.Int64N(1024))
		require.NoError(t, err)

		s := &Storage{
			gr:           dashv1.DashboardResourceInfo.GroupResource(),
			codec:        apitesting.TestCodec(rtcodecs, dashv1.DashboardResourceInfo.GroupVersion()),
			snowflake:    node,
			getDynClient: failingDynClient(errors.New("no config")),
			opts: StorageOptions{
				Scheme:              rtscheme,
				EnableFolderSupport: true,
			},
		}

		ctx := authlib.WithAuthInfo(context.Background(),
			&identity.StaticRequester{UserID: 1, UserUID: "u1", Type: authlib.TypeUser},
		)

		oldDash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "dash"}}
		oldMeta, err := utils.MetaAccessor(oldDash)
		require.NoError(t, err)
		oldMeta.SetFolder("same-folder")

		newDash := oldDash.DeepCopy()
		newMeta, err := utils.MetaAccessor(newDash)
		require.NoError(t, err)
		newMeta.SetAnnotation(utils.AnnoKeyManagerKind, string(utils.ManagerKindKubectl))
		newMeta.SetAnnotation(utils.AnnoKeyManagerIdentity, "my-kubectl")

		_, err = s.prepareObjectForUpdate(ctx, newDash, oldDash)
		require.Error(t, err, "manager addition in same folder should trigger folder check")
		require.ErrorContains(t, err, "no config")
	})

	t.Run("update: no manager change in same folder skips check", func(t *testing.T) {
		_ = dashv1.AddToScheme(rtscheme)
		node, err := snowflake.NewNode(rand.Int64N(1024))
		require.NoError(t, err)

		s := &Storage{
			gr:        dashv1.DashboardResourceInfo.GroupResource(),
			codec:     apitesting.TestCodec(rtcodecs, dashv1.DashboardResourceInfo.GroupVersion()),
			snowflake: node,
			opts: StorageOptions{
				Scheme:              rtscheme,
				EnableFolderSupport: true,
			},
		}

		ctx := authlib.WithAuthInfo(context.Background(),
			&identity.StaticRequester{UserID: 1, UserUID: "u1", Type: authlib.TypeUser},
		)

		oldDash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "dash"}}
		oldMeta, err := utils.MetaAccessor(oldDash)
		require.NoError(t, err)
		oldMeta.SetFolder("same-folder")

		newDash := oldDash.DeepCopy()

		_, err = s.prepareObjectForUpdate(ctx, newDash, oldDash)
		require.NoError(t, err, "same manager and folder should not trigger folder check")
	})

	t.Run("update: folder change fails when folder read fails", func(t *testing.T) {
		_ = dashv1.AddToScheme(rtscheme)
		node, err := snowflake.NewNode(rand.Int64N(1024))
		require.NoError(t, err)

		s := &Storage{
			gr:           dashv1.DashboardResourceInfo.GroupResource(),
			codec:        apitesting.TestCodec(rtcodecs, dashv1.DashboardResourceInfo.GroupVersion()),
			snowflake:    node,
			getDynClient: failingDynClient(errors.New("no config")),
			opts: StorageOptions{
				Scheme:              rtscheme,
				EnableFolderSupport: true,
			},
		}

		ctx := authlib.WithAuthInfo(context.Background(),
			&identity.StaticRequester{UserID: 1, UserUID: "u1", Type: authlib.TypeUser},
		)

		oldDash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "dash"}}
		oldMeta, err := utils.MetaAccessor(oldDash)
		require.NoError(t, err)
		oldMeta.SetFolder("folder-a")

		newDash := oldDash.DeepCopy()
		newMeta, err := utils.MetaAccessor(newDash)
		require.NoError(t, err)
		newMeta.SetFolder("folder-b")

		_, err = s.prepareObjectForUpdate(ctx, newDash, oldDash)
		require.Error(t, err)
		require.ErrorContains(t, err, "no config")
	})

	t.Run("skips when folder annotation is 'general' (canonical root)", func(t *testing.T) {
		s := &Storage{
			opts:         StorageOptions{EnableFolderSupport: true},
			getDynClient: failingDynClient(errors.New("dynamic client should not be consulted for root parent")),
		}
		obj := makeDashboard(t, folder.GeneralFolderUID, nil)
		require.NoError(t, s.ensureRepoManagedByParentFolder(context.Background(), obj))
	})
}

func TestVerifyFolder(t *testing.T) {
	_ = dashv1.AddToScheme(rtscheme)

	makeDash := func(t *testing.T, parent string) utils.GrafanaMetaAccessor {
		t.Helper()
		dash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "d1", Namespace: "default"}}
		dash.SetGroupVersionKind(dashv1.DashboardResourceInfo.GroupVersionKind())
		acc, err := utils.MetaAccessor(dash)
		require.NoError(t, err)
		if parent != "" {
			acc.SetFolder(parent)
		}
		return acc
	}

	t.Run("support enabled, empty folder passes", func(t *testing.T) {
		s := &Storage{
			gr:   dashv1.DashboardResourceInfo.GroupResource(),
			opts: StorageOptions{EnableFolderSupport: true},
		}
		obj := makeDash(t, "")
		require.NoError(t, s.verifyFolder(obj))
		require.Empty(t, obj.GetFolder())
	})

	t.Run("support enabled, folder set passes unchanged", func(t *testing.T) {
		s := &Storage{
			gr:   dashv1.DashboardResourceInfo.GroupResource(),
			opts: StorageOptions{EnableFolderSupport: true},
		}
		obj := makeDash(t, "my-folder")
		require.NoError(t, s.verifyFolder(obj))
		require.Equal(t, "my-folder", obj.GetFolder())
	})

	t.Run("support disabled, empty folder passes", func(t *testing.T) {
		s := &Storage{
			gr:   dashv1.DashboardResourceInfo.GroupResource(),
			opts: StorageOptions{EnableFolderSupport: false},
		}
		obj := makeDash(t, "")
		require.NoError(t, s.verifyFolder(obj))
	})

	t.Run("support disabled, folder set returns Invalid (422) with field cause", func(t *testing.T) {
		s := &Storage{
			gr:   dashv1.DashboardResourceInfo.GroupResource(),
			opts: StorageOptions{EnableFolderSupport: false},
		}
		obj := makeDash(t, "my-folder")
		err := s.verifyFolder(obj)
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err), "expected Invalid (422), got %T: %v", err, err)

		status, ok := err.(apierrors.APIStatus)
		require.True(t, ok, "error should implement APIStatus")
		require.NotNil(t, status.Status().Details)
		require.NotEmpty(t, status.Status().Details.Causes)
		require.Equal(t,
			"metadata.annotations[grafana.app/folder]",
			status.Status().Details.Causes[0].Field,
		)
	})
}

func TestPrepareObjectForStorage_FolderSupportDisabled(t *testing.T) {
	_ = dashv1.AddToScheme(rtscheme)
	node, err := snowflake.NewNode(rand.Int64N(1024))
	require.NoError(t, err)

	s := &Storage{
		gr:        dashv1.DashboardResourceInfo.GroupResource(),
		codec:     apitesting.TestCodec(rtcodecs, dashv1.DashboardResourceInfo.GroupVersion()),
		snowflake: node,
		opts: StorageOptions{
			Scheme:              rtscheme,
			EnableFolderSupport: false,
		},
	}

	ctx := authlib.WithAuthInfo(context.Background(),
		&identity.StaticRequester{UserID: 1, UserUID: "u1", Type: authlib.TypeUser},
	)

	t.Run("create: folder annotation returns Invalid (422)", func(t *testing.T) {
		dash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "d1"}}
		meta, err := utils.MetaAccessor(dash)
		require.NoError(t, err)
		meta.SetFolder("nope")

		_, err = s.prepareObjectForStorage(ctx, dash)
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err), "expected Invalid (422), got %T: %v", err, err)
	})

	t.Run("update: introducing a folder annotation returns Invalid (422)", func(t *testing.T) {
		oldDash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "d1"}}
		newDash := oldDash.DeepCopy()
		meta, err := utils.MetaAccessor(newDash)
		require.NoError(t, err)
		meta.SetFolder("nope")

		_, err = s.prepareObjectForUpdate(ctx, newDash, oldDash)
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err), "expected Invalid (422), got %T: %v", err, err)
	})

	t.Run("create: no folder annotation succeeds", func(t *testing.T) {
		dash := &dashv1.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "d2"}}
		_, err := s.prepareObjectForStorage(ctx, dash)
		require.NoError(t, err)
	})
}

// fakeSearchIndex is a minimal resourcepb.ResourceIndexClient for tests. Search
// reports a hit when the request filters on a deprecatedInternalID label whose
// value is listed in inUse, and reports no hits otherwise.
type fakeSearchIndex struct {
	resourcepb.ResourceIndexClient
	inUse map[string]bool // deprecatedInternalID label values that already exist
}

func (f *fakeSearchIndex) Search(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	rsp := &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{}}
	for _, label := range req.GetOptions().GetLabels() {
		if label.GetKey() != utils.LabelKeyDeprecatedInternalID {
			continue
		}
		for _, v := range label.GetValues() {
			if f.inUse[v] {
				rsp.Results.Rows = append(rsp.Results.Rows, &resourcepb.ResourceTableRow{})
			}
		}
	}
	return rsp, nil
}
