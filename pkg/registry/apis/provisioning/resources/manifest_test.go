package resources

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

)

func TestManifestSupportedResources(t *testing.T) {
	folder := SupportedResource{GroupKind: schema.GroupKind{Group: "folder.grafana.app", Kind: "Folder"}, Capabilities: sets.New(CapabilityFolder)}

	t.Run("adds the kinds that opt in to provisioning", func(t *testing.T) {
		lister := NewMockManifestLister(t)
		lister.EXPECT().ListManifests(mock.Anything).Return(testManifestList(
			testManifestKind("Widget", true, true),
			testManifestKind("Gadget", true, false),
			testManifestKind("Other", false, true),
		), nil)

		got := ManifestSupportedResources(lister, []SupportedResource{folder})(context.Background())

		require.Equal(t, []SupportedResource{
			folder,
			{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Widget"}, Capabilities: sets.New(CapabilityFolder)},
			{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Gadget"}, Capabilities: sets.New[string]()},
		}, got)
	})

	t.Run("keeps the configured capabilities of a kind that a manifest declares", func(t *testing.T) {
		configured := SupportedResource{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Widget"}, Capabilities: sets.New(CapabilityDisabled)}
		lister := NewMockManifestLister(t)
		lister.EXPECT().ListManifests(mock.Anything).Return(testManifestList(testManifestKind("Widget", true, true)), nil)

		got := ManifestSupportedResources(lister, []SupportedResource{configured})(context.Background())

		require.Equal(t, []SupportedResource{configured}, got)
	})

	t.Run("reads the manifests again only after the cache expires", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			lister := NewMockManifestLister(t)
			lister.EXPECT().ListManifests(mock.Anything).Return(testManifestList(testManifestKind("Widget", true, true)), nil).Once()
			supported := ManifestSupportedResources(lister, nil)

			require.Len(t, supported(context.Background()), 1)
			require.Len(t, supported(context.Background()), 1)

			lister.EXPECT().ListManifests(mock.Anything).Return(testManifestList(), nil).Once()
			time.Sleep(manifestCacheTTL)
			require.Empty(t, supported(context.Background()))
		})
	})

	t.Run("keeps the last set when the manifests cannot be read", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			lister := NewMockManifestLister(t)
			lister.EXPECT().ListManifests(mock.Anything).Return(testManifestList(testManifestKind("Widget", true, true)), nil).Once()
			supported := ManifestSupportedResources(lister, nil)
			require.Len(t, supported(context.Background()), 1)

			lister.EXPECT().ListManifests(mock.Anything).Return(nil, errors.New("unavailable")).Once()
			time.Sleep(manifestCacheTTL)
			require.Len(t, supported(context.Background()), 1)
		})
	})

	t.Run("returns the configured set without a lister", func(t *testing.T) {
		require.Equal(t, []SupportedResource{folder}, ManifestSupportedResources(nil, []SupportedResource{folder})(context.Background()))
	})
}
