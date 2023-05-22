package secretscan

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
)

func TestService_CheckTokens(t *testing.T) {
	type testCase struct {
		desc            string
		retrievedTokens []apikey.APIKey
		wantHashes      []string
		leakedTokens    []Token
		notify          bool
		revoke          bool
	}

	ctx := context.Background()

	falseBool := false
	trueBool := true

	testCases := []testCase{
		{
			desc:            "no tokens",
			retrievedTokens: []apikey.APIKey{},
			leakedTokens:    []Token{},
			notify:          false,
			revoke:          false,
		},
		{
			desc: "one token leaked - no revoke, no notify",
			retrievedTokens: []apikey.APIKey{{
				ID:               1,
				OrgID:            2,
				Name:             "test",
				Key:              "test-hash-1",
				Role:             "Viewer",
				Expires:          nil,
				ServiceAccountId: new(int64),
				IsRevoked:        &falseBool,
			}},
			wantHashes:   []string{"test-hash-1"},
			leakedTokens: []Token{{Hash: "test-hash-1"}},
			notify:       false,
			revoke:       false,
		},
		{
			desc: "one token leaked - revoke, no notify",
			retrievedTokens: []apikey.APIKey{{
				ID:               1,
				OrgID:            2,
				Name:             "test",
				Key:              "test-hash-1",
				Role:             "Viewer",
				Expires:          nil,
				ServiceAccountId: new(int64),
				IsRevoked:        &falseBool,
			}},
			wantHashes:   []string{"test-hash-1"},
			leakedTokens: []Token{{Hash: "test-hash-1"}},
			notify:       false,
			revoke:       true,
		},
		{
			desc: "two tokens - one revoke, notify",
			retrievedTokens: []apikey.APIKey{{
				ID:               1,
				OrgID:            2,
				Name:             "test",
				Key:              "test-hash-1",
				Role:             "Viewer",
				Expires:          nil,
				ServiceAccountId: new(int64),
				IsRevoked:        &falseBool,
			}, {
				ID:               2,
				OrgID:            4,
				Name:             "test-2",
				Key:              "test-hash-2",
				Role:             "Viewer",
				Expires:          nil,
				ServiceAccountId: new(int64),
				IsRevoked:        &falseBool,
			}},
			wantHashes:   []string{"test-hash-1", "test-hash-2"},
			leakedTokens: []Token{{Hash: "test-hash-2"}},
			notify:       true,
			revoke:       true,
		},
		{
			desc: "one token already revoked should not be checked",
			retrievedTokens: []apikey.APIKey{{
				ID:               1,
				OrgID:            2,
				Name:             "test",
				Key:              "test-hash-1",
				Role:             "Viewer",
				Expires:          nil,
				ServiceAccountId: new(int64),
				IsRevoked:        &trueBool,
			}},
			wantHashes:   []string{},
			leakedTokens: []Token{},
			notify:       false,
			revoke:       true,
		},
		{
			desc: "one token expired should not be checked",
			retrievedTokens: []apikey.APIKey{{
				ID:               1,
				OrgID:            2,
				Name:             "test",
				Key:              "test-hash-1",
				Role:             "Viewer",
				Expires:          new(int64),
				ServiceAccountId: new(int64),
				IsRevoked:        &falseBool,
			}},
			wantHashes:   []string{},
			leakedTokens: []Token{},
			notify:       false,
			revoke:       true,
		},
	}

	for _, tt := range testCases {
		t.Run(tt.desc, func(t *testing.T) {
			tokenStore := &MockTokenRetriever{keys: tt.retrievedTokens}
			client := &MockSecretScanClient{tokens: tt.leakedTokens}
			notifier := &MockSecretScanNotifier{}

			service := &Service{
				store:         tokenStore,
				client:        client,
				webHookClient: notifier,
				logger:        log.New("secretscan"),
				webHookNotify: tt.notify,
				revoke:        tt.revoke,
			}

			err := service.CheckTokens(ctx)
			require.NoError(t, err)

			if len(tt.wantHashes) > 0 {
				assert.Equal(t, tt.wantHashes, client.checkCalls[0].([]string))
			} else {
				assert.Empty(t, client.checkCalls)
			}

			if len(tt.leakedTokens) > 0 {
				if tt.revoke {
					assert.Len(t, tokenStore.revokeCalls, len(tt.leakedTokens))
				} else {
					assert.Empty(t, tokenStore.revokeCalls)
				}
			}

			if tt.notify {
				assert.Len(t, notifier.notifyCalls, len(tt.leakedTokens))
			} else {
				assert.Empty(t, notifier.notifyCalls)
			}
		})
	}
}
