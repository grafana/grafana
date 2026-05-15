package utils_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	paletteutils "github.com/grafana/grafana/pkg/registry/apis/palettes/utils"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/util"
)

func TestUIDSeparatorSanityCheck(t *testing.T) {
	// Palette names use "-" to separate owner UID and slug.
	// Sanity-check generated Grafana UIDs to protect parser assumptions.
	for range 100 {
		uid := util.GenerateShortUID()
		require.NotEmpty(t, uid)
		require.False(t, strings.Contains(uid, "-"))
	}
}

func TestParseOwnerWithSuffix(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantOwner  prefutils.OwnerReference
		wantSlug   string
		wantParsed bool
	}{
		{
			name:       "org scoped",
			input:      "org-corporate",
			wantOwner:  prefutils.NamespaceOwner(),
			wantSlug:   "corporate",
			wantParsed: true,
		},
		{
			name:       "user scoped with hyphenated slug",
			input:      "user-abc123-sunset-warm",
			wantOwner:  prefutils.UserOwner("abc123"),
			wantSlug:   "sunset-warm",
			wantParsed: true,
		},
		{
			name:       "team scoped",
			input:      "team-frontend-neon",
			wantOwner:  prefutils.TeamOwner("frontend"),
			wantSlug:   "neon",
			wantParsed: true,
		},
		{
			name:       "invalid empty org slug",
			input:      "org-",
			wantOwner:  prefutils.OwnerReference{},
			wantSlug:   "",
			wantParsed: false,
		},
		{
			name:       "invalid empty user uid",
			input:      "user--sunset",
			wantOwner:  prefutils.OwnerReference{},
			wantSlug:   "",
			wantParsed: false,
		},
		{
			name:       "invalid empty user slug",
			input:      "user-abc123-",
			wantOwner:  prefutils.OwnerReference{},
			wantSlug:   "",
			wantParsed: false,
		},
		{
			name:       "invalid random",
			input:      "random",
			wantOwner:  prefutils.OwnerReference{},
			wantSlug:   "",
			wantParsed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			owner, slug, ok := paletteutils.ParseOwnerWithSuffix(tt.input)
			require.Equal(t, tt.wantOwner, owner)
			require.Equal(t, tt.wantSlug, slug)
			require.Equal(t, tt.wantParsed, ok)
		})
	}
}

func TestBuildName(t *testing.T) {
	require.Equal(t, "org-sunset", paletteutils.BuildName(prefutils.NamespaceOwner(), "sunset"))
	require.Equal(t, "user-abc123-sunset", paletteutils.BuildName(prefutils.UserOwner("abc123"), "sunset"))
	require.Equal(t, "team-frontend-sunset", paletteutils.BuildName(prefutils.TeamOwner("frontend"), "sunset"))
}

func TestBuildNameRoundTrip(t *testing.T) {
	tests := []struct {
		name  string
		owner prefutils.OwnerReference
		slug  string
	}{
		{
			name:  "org",
			owner: prefutils.NamespaceOwner(),
			slug:  "corporate",
		},
		{
			name:  "user",
			owner: prefutils.UserOwner("abc123"),
			slug:  "sunset-warm",
		},
		{
			name:  "team",
			owner: prefutils.TeamOwner("frontend"),
			slug:  "neon",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			name := paletteutils.BuildName(tt.owner, tt.slug)
			gotOwner, gotSlug, ok := paletteutils.ParseOwnerWithSuffix(name)
			require.True(t, ok)
			require.Equal(t, tt.owner, gotOwner)
			require.Equal(t, tt.slug, gotSlug)
			require.Equal(t, name, paletteutils.BuildName(gotOwner, gotSlug))
		})
	}
}
