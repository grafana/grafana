package secretscan

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
)

const defaultURL = "https://secret-scanning.grafana.net"

type Checker interface {
	CheckTokens(ctx context.Context) error
}

type CheckerClient interface {
	CheckTokens(ctx context.Context, keyHashes []string) ([]Token, error)
}

type WebHookClient interface {
	Notify(ctx context.Context, token *Token, tokenName string, revoked bool) error
}

type SATokenRetriever interface {
	ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error)
	RevokeServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error
}

// Secret Scan Service is grafana's service for checking leaked keys.
type Service struct {
	store         SATokenRetriever
	client        CheckerClient
	webHookClient WebHookClient
	logger        log.Logger
	webHookNotify bool
	revoke        bool // whether to revoke leaked tokens
}

func NewService(store SATokenRetriever, cfg *setting.Cfg) (*Service, error) {
	secretscanBaseURL := cfg.SectionWithEnvOverrides("secretscan").Key("base_url").MustString(defaultURL)
	// URL to send outgoing webhook when a token is leaked.
	oncallURL := cfg.SectionWithEnvOverrides("secretscan").Key("oncall_url").MustString("")
	revoke := cfg.SectionWithEnvOverrides("secretscan").Key("revoke").MustBool(true)

	client, err := newClient(secretscanBaseURL, cfg.BuildVersion, cfg.Env == setting.Dev)
	if err != nil {
		return nil, fmt.Errorf("failed to create secretscan client: %w", err)
	}

	var webHookClient WebHookClient
	if oncallURL != "" {
		var errWebhook error
		webHookClient, errWebhook = newWebHookClient(oncallURL, cfg.BuildVersion, cfg.Env == setting.Dev)
		if errWebhook != nil {
			return nil, fmt.Errorf("failed to create secretscan webhook client: %w", errWebhook)
		}
	}

	return &Service{
		store:         store,
		client:        client,
		webHookClient: webHookClient,
		logger:        log.New("secretscan"),
		webHookNotify: oncallURL != "",
		revoke:        revoke,
	}, nil
}

func (s *Service) RetrieveActiveTokens(ctx context.Context) ([]apikey.APIKey, error) {
	saTokens, err := s.store.ListTokens(ctx, &serviceaccounts.GetSATokensQuery{})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve service account tokens: %w", err)
	}

	return saTokens, nil
}

// hasExpired returns true if the token has expired.
// Duplicate to SA API. Remerge.
func hasExpired(expiration *int64) bool {
	if expiration == nil {
		return false
	}

	v := time.Unix(*expiration, 0)

	return (v).Before(time.Now())
}

// CheckTokens checks for leaked tokens.
func (s *Service) CheckTokens(ctx context.Context) error {
	// Retrieve all active tokens from the database.
	tokens, err := s.RetrieveActiveTokens(ctx)
	if err != nil {
		return fmt.Errorf("failed to retrieve tokens for checking: %w", err)
	}

	hashes, hashMap := s.filterCheckableTokens(tokens)
	if len(hashes) == 0 {
		s.logger.Debug("no active tokens to check")

		return nil
	}

	// Check if any leaked tokens exist.
	secretscanTokens, err := s.client.CheckTokens(ctx, hashes)
	if err != nil {
		return fmt.Errorf("failed to check tokens: %w", err)
	}

	// Revoke leaked tokens.
	// Could be done in bulk but we don't expect more than 1 or 2 tokens to be leaked per check.
	for _, secretscanToken := range secretscanTokens {
		secretscanToken := secretscanToken
		leakedToken := hashMap[secretscanToken.Hash]

		if s.revoke {
			if err := s.store.RevokeServiceAccountToken(
				ctx, leakedToken.OrgID, *leakedToken.ServiceAccountId, leakedToken.ID); err != nil {
				s.logger.Error("failed to delete leaked token. Revoke manually.",
					"error", err, "url", secretscanToken.URL, "reported_at", secretscanToken.ReportedAt,
					"token_id", leakedToken.ID, "token", leakedToken.Name, "org", leakedToken.OrgID,
					"serviceAccount", *leakedToken.ServiceAccountId)
			}
		}

		if s.webHookNotify {
			if err := s.webHookClient.Notify(ctx, &secretscanToken, leakedToken.Name, s.revoke); err != nil {
				s.logger.Warn("failed to call token leak webhook", "error", err)
			}
		}

		s.logger.Warn("found leaked token",
			"url", secretscanToken.URL, "reported_at", secretscanToken.ReportedAt,
			"token_id", leakedToken.ID, "token", leakedToken.Name, "org", leakedToken.OrgID,
			"serviceAccount", *leakedToken.ServiceAccountId, "revoked", s.revoke)
	}

	return nil
}

// filterCheckableTokens returns a list of tokens that can be checked and a map of tokens to their hashes.
func (*Service) filterCheckableTokens(tokens []apikey.APIKey) ([]string, map[string]apikey.APIKey) {
	hashes := make([]string, 0, len(tokens))
	hashMap := make(map[string]apikey.APIKey)

	for _, token := range tokens {
		if hasExpired(token.Expires) || (token.IsRevoked != nil && *token.IsRevoked) {
			continue
		}

		hashes = append(hashes, token.Key)
		hashMap[token.Key] = token
	}

	return hashes, hashMap
}
