package dualwrite

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"

	"github.com/grafana/grafana/pkg/apiserver/rest"
)

func TestParseContinueTokens(t *testing.T) {
	tcs := []struct {
		name         string
		token        string
		legacyToken  string
		unifiedToken string
	}{
		{
			name:         "Should handle empty token",
			token:        "",
			legacyToken:  "",
			unifiedToken: "",
		},
		{
			name:         "Should handle legacy token",
			token:        "MXwy",
			legacyToken:  "MXwy",
			unifiedToken: "",
		},
		{
			name: "Should handle new token format",
			// both slots taken 'MXwy,eyJvIjoxLCJ2IjoxNzQ5NTY1NTU4MDc4OTkwLCJzIjpmYWxzZX0='
			token:        "TVh3eSxleUp2SWpveExDSjJJam94TnpRNU5UWTFOVFU0TURjNE9Ua3dMQ0p6SWpwbVlXeHpaWDA9",
			legacyToken:  "MXwy",
			unifiedToken: "eyJvIjoxLCJ2IjoxNzQ5NTY1NTU4MDc4OTkwLCJzIjpmYWxzZX0=",
		},
		{
			name: "Should handle new token with only unified token (mode >= 3)",
			// first slot empty ',eyJvIjoxLCJ2IjoxNzQ5NTY1NTU4MDc4OTkwLCJzIjpmYWxzZX0='
			token:        "LGV5SnZJam94TENKMklqb3hOelE1TlRZMU5UVTRNRGM0T1Rrd0xDSnpJanBtWVd4elpYMD0=",
			legacyToken:  "",
			unifiedToken: "eyJvIjoxLCJ2IjoxNzQ5NTY1NTU4MDc4OTkwLCJzIjpmYWxzZX0=",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			legacyToken, unifiedToken, err := parseContinueTokens(tc.token)
			require.NoError(t, err)
			require.Equal(t, legacyToken, tc.legacyToken)
			require.Equal(t, unifiedToken, tc.unifiedToken)
		})
	}
}

func TestBuildContinueToken(t *testing.T) {
	tcs := []struct {
		name          string
		legacyToken   string
		unifiedToken  string
		shouldBeEmpty bool
	}{
		{
			name:         "Should handle both tokens",
			legacyToken:  "abc",
			unifiedToken: "xyz",
		},
		{
			name:        "Should handle legacy token standalone",
			legacyToken: "abc",
		},
		{
			name:         "Should handle unified token standalone",
			unifiedToken: "xyz",
		},
		{
			name:          "Should handle both tokens empty",
			shouldBeEmpty: true,
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			token := buildContinueToken(tc.legacyToken, tc.unifiedToken)
			legacyToken, unifiedToken, err := parseContinueTokens(token)
			require.NoError(t, err)
			require.Equal(t, legacyToken, tc.legacyToken)
			require.Equal(t, unifiedToken, tc.unifiedToken)
			if tc.shouldBeEmpty {
				require.Equal(t, "", token)
			}
		})
	}
}

func TestInvalidToken(t *testing.T) {
	// nolint: gosec
	invalidToken := "325232ff4fF->"
	_, _, err := parseContinueTokens(invalidToken)
	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err))
}

func TestListRejectsMalformedContinueToken(t *testing.T) {
	for _, token := range []string{
		"not-base64!",
		base64.StdEncoding.EncodeToString([]byte("legacy,unified,extra")),
		base64.StdEncoding.EncodeToString([]byte(",")),
	} {
		legacy, unified := &fakeStorage{}, &fakeStorage{}
		store, err := newStorage(kind, rest.Mode1, legacy, unified)
		require.NoError(t, err)
		_, err = store.List(context.Background(), &metainternalversion.ListOptions{Continue: token})
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.Empty(t, legacy.listCalls)
		require.Empty(t, unified.listCalls)
	}
}
