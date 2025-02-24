package apistore

import (
	"context"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"
	"k8s.io/apimachinery/pkg/api/apitesting"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"
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
			LargeObjectSupport: nil,
		},
	}

	ctx := authtypes.WithAuthInfo(context.Background(), &identity.StaticRequester{UserID: 1, UserUID: "user-uid", Type: authtypes.TypeUser})

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

	t.Run("Should keep repo info", func(t *testing.T) {
		dashboard := v0alpha1.Dashboard{}
		dashboard.Name = "test-name"
		obj := dashboard.DeepCopyObject()
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		now := time.Now()
		meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
			Name:      "test-repo",
			Path:      "test/path",
			Hash:      "hash",
			Timestamp: &now,
		})

		encodedData, err := s.prepareObjectForStorage(ctx, obj)
		require.NoError(t, err)

		newObject, _, err := s.codec.Decode(encodedData, nil, &v0alpha1.Dashboard{})
		require.NoError(t, err)
		meta, err = utils.MetaAccessor(newObject)
		require.NoError(t, err)
		require.Equal(t, meta.GetRepositoryHash(), "hash")
		require.Equal(t, meta.GetRepositoryName(), "test-repo")
		require.Equal(t, meta.GetRepositoryPath(), "test/path")
		ts, err := meta.GetRepositoryTimestamp()
		require.NoError(t, err)
		parsed, err := time.Parse(time.RFC3339, now.UTC().Format(time.RFC3339))
		require.NoError(t, err)
		require.Equal(t, ts, &parsed)
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
}
