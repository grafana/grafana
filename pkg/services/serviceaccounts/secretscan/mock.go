package secretscan

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type MockTokenRetriever struct {
	keys      []apikey.APIKey
	errList   error
	errRevoke error

	listCalls   []any
	revokeCalls [][]any
}

func (m *MockTokenRetriever) ListTokens(
	ctx context.Context, query *serviceaccounts.GetSATokensQuery,
) ([]apikey.APIKey, error) {
	m.listCalls = append(m.listCalls, query)

	return m.keys, m.errList
}

func (m *MockTokenRetriever) RevokeServiceAccountToken(
	ctx context.Context, orgID, serviceAccountID, tokenID int64,
) error {
	m.revokeCalls = append(m.revokeCalls, []any{orgID, serviceAccountID, tokenID})

	return m.errRevoke
}

type MockSecretScaner struct{}

func (m *MockSecretScaner) CheckTokens(ctx context.Context) error {
	return nil
}

type MockSecretScanClient struct {
	tokens []Token
	err    error

	checkCalls []any
}

func (m *MockSecretScanClient) CheckTokens(ctx context.Context, keyHashes []string) ([]Token, error) {
	m.checkCalls = append(m.checkCalls, keyHashes)

	return m.tokens, m.err
}

type MockSecretScanNotifier struct {
	err error

	notifyCalls [][]any
}

func (m *MockSecretScanNotifier) Notify(ctx context.Context,
	token *Token, tokenName string, revoked bool,
) error {
	m.notifyCalls = append(m.notifyCalls, []any{token, tokenName, revoked})

	return m.err
}
