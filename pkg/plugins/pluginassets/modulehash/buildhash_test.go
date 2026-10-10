package modulehash

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

// AC-2: FS/unsigned plugin returns a stable non-empty buildHash;
// identical bytes -> identical hash across replicas (determinism).
func TestBuildHash_FS_StableNonEmpty(t *testing.T) {
	fs := plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))

	h1, err := BuildHash(fs)
	require.NoError(t, err)
	require.NotEmpty(t, h1, "FS build hash should be non-empty")

	// Determinism: a second computation over the same bytes yields the same hash.
	h2, err := BuildHash(fs)
	require.NoError(t, err)
	require.Equal(t, h1, h2, "identical bytes must produce identical build hash")
}

// AC-2: build hash is a hex-encoded sha256 digest (64 hex chars).
func TestBuildHash_FS_Sha256HexFormat(t *testing.T) {
	fs := plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))

	h, err := BuildHash(fs)
	require.NoError(t, err)
	require.Len(t, h, 64, "sha256 hex digest should be 64 characters")
	require.True(t, isHex(h), "build hash should be hex-encoded")
}

// AC-2: different plugin build content -> different build hash.
func TestBuildHash_FS_DifferentContentDifferentHash(t *testing.T) {
	fsA := plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))
	fsB := plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested"))

	hA, err := BuildHash(fsA)
	require.NoError(t, err)
	hB, err := BuildHash(fsB)
	require.NoError(t, err)

	require.NotEqual(t, hA, hB, "different build content must produce different hash")
}

// AC-1 / P8: The signed-CDN ModuleHash output must be byte-identical to
// pre-change behaviour. Adding a build-hash path must not alter SRI output.
func TestBuildHash_SignedCDNModuleHashUnchanged(t *testing.T) {
	const pluginID = "grafana-test-datasource"
	pCfg := &config.PluginManagementCfg{
		PluginsCDNURLTemplate: "http://cdn.example.com",
		PluginSettings: config.PluginSettings{
			pluginID: {"cdn": "true"},
		},
		Features: config.Features{SriChecksEnabled: true},
	}
	p := newPlugin(
		pluginID,
		withSignatureStatus(plugins.SignatureStatusValid),
		withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
		withClass(plugins.ClassExternal),
	)
	svc := NewCalculator(
		pCfg,
		newPluginRegistry(t, p),
		pluginscdn.ProvideService(pCfg),
		signature.ProvideService(pCfg, statickey.New()),
	)

	// Golden fixture: byte-identical to the value asserted by Test_ModuleHash.
	want := newSRIHash(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03")
	got := svc.ModuleHash(context.Background(), pluginID, "")
	require.Equal(t, want, got, "signed-CDN module hash must be byte-identical to pre-change golden fixture")
}

// AC-2 (integration): the Calculator exposes buildHash for an FS/unsigned plugin
// via a BuildHash method, returning a stable non-empty digest.
func TestCalculator_BuildHash_FSPlugin(t *testing.T) {
	const pluginID = "grafana-test-datasource"
	pCfg := &config.PluginManagementCfg{
		PluginSettings: config.PluginSettings{},
		Features:       config.Features{SriChecksEnabled: true},
	}
	p := newPlugin(
		pluginID,
		withSignatureStatus(plugins.SignatureStatusUnsigned),
		withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
	)
	svc := NewCalculator(
		pCfg,
		newPluginRegistry(t, p),
		pluginscdn.ProvideService(pCfg),
		signature.ProvideService(pCfg, statickey.New()),
	)

	bh := svc.BuildHash(context.Background(), pluginID, "")
	require.NotEmpty(t, bh, "FS/unsigned plugin should expose a non-empty build hash")

	// Direct helper agrees with the exposed value (stability).
	direct, err := BuildHash(p.FS)
	require.NoError(t, err)
	require.Equal(t, direct, bh)
}

// The Calculator caches buildHash for the hot bootdata path, but must recompute when
// the active build is replaced in place (an in-process reinstall/rebuild that keeps the
// same version string) — otherwise it would advertise a hash the registry no longer has.
func TestCalculator_BuildHash_RecomputesAfterBuildReplaced(t *testing.T) {
	const pluginID = "grafana-test-datasource"
	pCfg := &config.PluginManagementCfg{
		PluginSettings: config.PluginSettings{},
		Features:       config.Features{SriChecksEnabled: true},
	}
	p1 := newPlugin(
		pluginID,
		withSignatureStatus(plugins.SignatureStatusUnsigned),
		withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
	)
	reg := newPluginRegistry(t, p1)
	svc := NewCalculator(
		pCfg,
		reg,
		pluginscdn.ProvideService(pCfg),
		signature.ProvideService(pCfg, statickey.New()),
	)

	first := svc.BuildHash(context.Background(), pluginID, "")
	require.NotEmpty(t, first)
	// A repeated call for the same active build is a cache hit (same value).
	require.Equal(t, first, svc.BuildHash(context.Background(), pluginID, ""))

	// Replace the active build in place: same id/version, different content, new pointer.
	p2 := newPlugin(
		pluginID,
		withSignatureStatus(plugins.SignatureStatusUnsigned),
		withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested"))),
	)
	require.NoError(t, reg.Add(context.Background(), p2))

	// The cache must invalidate and return the new build's hash, not the stale one.
	second := svc.BuildHash(context.Background(), pluginID, "")
	require.NotEmpty(t, second)
	require.NotEqual(t, first, second, "build hash must be recomputed after an in-place build replacement")

	directNew, err := BuildHash(p2.FS)
	require.NoError(t, err)
	require.Equal(t, directNew, second)
}

// CDN-hosted plugins share one CDN across replicas (no per-replica drift) and must not be
// pinned to the local build-addressed route, so the Calculator returns no buildHash for them.
func TestCalculator_BuildHash_CDNPluginReturnsEmpty(t *testing.T) {
	const pluginID = "grafana-test-datasource"
	pCfg := &config.PluginManagementCfg{
		PluginsCDNURLTemplate: "http://cdn.example.com",
		PluginSettings: config.PluginSettings{
			pluginID: {"cdn": "true"},
		},
		Features: config.Features{SriChecksEnabled: true},
	}
	p := newPlugin(
		pluginID,
		withSignatureStatus(plugins.SignatureStatusValid),
		withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
		withClass(plugins.ClassExternal),
	)
	svc := NewCalculator(
		pCfg,
		newPluginRegistry(t, p),
		pluginscdn.ProvideService(pCfg),
		signature.ProvideService(pCfg, statickey.New()),
	)

	require.Empty(t, svc.BuildHash(context.Background(), pluginID, ""), "CDN plugins must not get a local buildHash")
}

func isHex(s string) bool {
	const hexDigits = "0123456789abcdef"
	for _, c := range s {
		if !strings.ContainsRune(hexDigits, c) {
			return false
		}
	}
	return len(s) > 0
}
