package aztokenprovider

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

var (
	azureTokenCache = NewConcurrentTokenCache()
)

type AzureTokenProvider interface {
	GetAccessToken(ctx context.Context, scopes []string) (string, error)
}

type tokenProviderImpl struct {
	tokenRetriever TokenRetriever
}

func NewAzureAccessTokenProvider(cfg *setting.Cfg, credentials azcredentials.AzureCredentials) (AzureTokenProvider, error) {
	if cfg == nil {
		err := fmt.Errorf("parameter 'cfg' cannot be nil")
		return nil, err
	}
	if credentials == nil {
		err := fmt.Errorf("parameter 'credentials' cannot be nil")
		return nil, err
	}

	var tokenRetriever TokenRetriever

	switch c := credentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		if !cfg.Azure.ManagedIdentityEnabled {
			err := fmt.Errorf("managed identity authentication is not enabled in Grafana config")
			return nil, err
		} else {
			tokenRetriever = getManagedIdentityTokenRetriever(cfg, c)
		}
	case *azcredentials.AzureClientSecretCredentials:
		tokenRetriever = getClientSecretTokenRetriever(c)
	case *azcredentials.AzureUserIdentityCredentials:
		if !cfg.Azure.UserIdentityEnabled {
			err := fmt.Errorf("user identity authentication is not enabled in Grafana config")
			return nil, err
		} else {
			tokenRetriever = getUserIdentityTokenRetriever(cfg, c)
		}
	default:
		err := fmt.Errorf("credentials of type '%s' not supported by authentication provider", c.AzureAuthType())
		return nil, err
	}

	tokenProvider := &tokenProviderImpl{
		tokenRetriever: tokenRetriever,
	}

	return tokenProvider, nil
}

func (provider *tokenProviderImpl) GetAccessToken(ctx context.Context, scopes []string) (string, error) {
	if ctx == nil {
		err := fmt.Errorf("parameter 'ctx' cannot be nil")
		return "", err
	}
	if scopes == nil {
		err := fmt.Errorf("parameter 'scopes' cannot be nil")
		return "", err
	}

	accessToken, err := azureTokenCache.GetAccessToken(ctx, provider.tokenRetriever, scopes)
	if err != nil {
		return "", err
	}
	return accessToken, nil
}

func getManagedIdentityTokenRetriever(cfg *setting.Cfg, credentials *azcredentials.AzureManagedIdentityCredentials) TokenRetriever {
	var clientId string
	if credentials.ClientId != "" {
		clientId = credentials.ClientId
	} else {
		clientId = cfg.Azure.ManagedIdentityClientId
	}
	return &managedIdentityTokenRetriever{
		clientId: clientId,
	}
}

func getClientSecretTokenRetriever(credentials *azcredentials.AzureClientSecretCredentials) TokenRetriever {
	var authority string
	if credentials.Authority != "" {
		authority = credentials.Authority
	} else {
		authority = resolveAuthorityForCloud(credentials.AzureCloud)
	}
	return &clientSecretTokenRetriever{
		authority:    authority,
		tenantId:     credentials.TenantId,
		clientId:     credentials.ClientId,
		clientSecret: credentials.ClientSecret,
	}
}

func getUserIdentityTokenRetriever(cfg *setting.Cfg, credentials *azcredentials.AzureUserIdentityCredentials) TokenRetriever {
	tokenEndpoint := credentials.TokenEndpoint
	if tokenEndpoint == "" {
		tokenEndpoint = cfg.Azure.UserIdentityTokenEndpoint
	}

	authHeader := credentials.AuthHeader
	if authHeader == "" {
		authHeader = cfg.Azure.UserIdentityAuthHeader
	}

	return &userIdentityTokenRetriever{
		tokenEndpoint: tokenEndpoint,
		authHeader:    authHeader,
	}
}

func resolveAuthorityForCloud(cloudName string) string {
	// Known Azure clouds
	switch cloudName {
	case setting.AzurePublic:
		return azidentity.AzurePublicCloud
	case setting.AzureChina:
		return azidentity.AzureChina
	case setting.AzureUSGovernment:
		return azidentity.AzureGovernment
	case setting.AzureGermany:
		return azidentity.AzureGermany
	default:
		return ""
	}
}

type managedIdentityTokenRetriever struct {
	clientId   string
	credential azcore.TokenCredential
}

func (c *managedIdentityTokenRetriever) GetCacheKey() string {
	clientId := c.clientId
	if clientId == "" {
		clientId = "system"
	}
	return fmt.Sprintf("azure|msi|%s", clientId)
}

func (c *managedIdentityTokenRetriever) Init() error {
	if credential, err := azidentity.NewManagedIdentityCredential(c.clientId, nil); err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *managedIdentityTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := c.credential.GetToken(ctx, policy.TokenRequestOptions{Scopes: scopes})
	if err != nil {
		return nil, err
	}

	return &AccessToken{Token: accessToken.Token, ExpiresOn: accessToken.ExpiresOn}, nil
}

type clientSecretTokenRetriever struct {
	authority    string
	tenantId     string
	clientId     string
	clientSecret string
	credential   azcore.TokenCredential
}

func (c *clientSecretTokenRetriever) GetCacheKey() string {
	return fmt.Sprintf("azure|clientsecret|%s|%s|%s|%s", c.authority, c.tenantId, c.clientId, hashSecret(c.clientSecret))
}

func (c *clientSecretTokenRetriever) Init() error {
	options := &azidentity.ClientSecretCredentialOptions{AuthorityHost: c.authority}
	if credential, err := azidentity.NewClientSecretCredential(c.tenantId, c.clientId, c.clientSecret, options); err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *clientSecretTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := c.credential.GetToken(ctx, policy.TokenRequestOptions{Scopes: scopes})
	if err != nil {
		return nil, err
	}

	return &AccessToken{Token: accessToken.Token, ExpiresOn: accessToken.ExpiresOn}, nil
}

type userIdentityTokenRetriever struct {
	tokenEndpoint string // token endpoint to retrieve the token from
	authHeader    string // exact Authorization header to be used to talk to the token endpoint
	client        *http.Client
}

func (c *userIdentityTokenRetriever) GetCacheKey() string {
	return fmt.Sprintf("azure|useridtoken|%s", c.tokenEndpoint)
}

func (c *userIdentityTokenRetriever) Init() error {
	c.client = &http.Client{Timeout: time.Second * 10}
	return nil
}

func (c *userIdentityTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	value := ctx.Value(proxyutil.ContextKeyLoginUser{})
	if value == nil {
		return nil, fmt.Errorf("failed to get signed-in user")
	}

	userId := value.(string)
	if userId == "" {
		return nil, fmt.Errorf("empty signed-in userId")
	}

	return c.getUserAccessToken(userId, scopes)
}

func (c *userIdentityTokenRetriever) getUserAccessToken(userId string, scopes []string) (*AccessToken, error) {
	// The token endpoint needs to support the following API:
	// POST {endpoint url}
	//
	// Headers:
	// "Content-Type", "application/x-www-form-urlencoded"
	// "Accept", "application/json"
	//
	// Body:
	// scope=xxx&user_id=xxx
	req, err := http.NewRequest("POST", c.tokenEndpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create token request, %w", err)
	}

	// Token server supports POST method with parameters in the body
	data := url.Values{}
	data.Set("scope", strings.Join(scopes, " "))
	data.Set("user_id", userId)
	dataEncoded := data.Encode()
	body := streaming.NopCloser(strings.NewReader(dataEncoded))

	size, err := body.Seek(0, io.SeekEnd) // Seek to the end to get the stream's size
	if err != nil {
		return nil, err
	}
	_, err = body.Seek(0, io.SeekStart)
	if err != nil {
		return nil, err
	}

	req.Body = body
	req.ContentLength = size
	req.Header.Set("Content-Length", strconv.FormatInt(size, 10))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	if c.authHeader != "" {
		req.Header.Set("Authorization", c.authHeader)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get AccessToken: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Println("error closing response:", err)
		}
	}()

	return c.getAccessTokenFromResponse(resp)
}

func (c *userIdentityTokenRetriever) getAccessTokenFromResponse(resp *http.Response) (*AccessToken, error) {
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return nil, fmt.Errorf("bad statuscode on token request: %d", resp.StatusCode)
	}

	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read token response: %w", err)
	}

	value := struct {
		Token     string      `json:"access_token"`
		ExpiresIn json.Number `json:"expires_in"`
		ExpiresOn string      `json:"expires_on"`
	}{}

	if err := json.Unmarshal(respBody, &value); err != nil {
		return nil, fmt.Errorf("failed to deserialize token response: %w", err)
	}
	t, err := value.ExpiresIn.Int64()
	if err != nil {
		return nil, fmt.Errorf("failed to get ExpiresIn property of the token: %w", err)
	}
	return &AccessToken{
		Token:     value.Token,
		ExpiresOn: time.Now().Add(time.Second * time.Duration(t)).UTC(),
	}, nil
}

func hashSecret(secret string) string {
	hash := sha256.New()
	_, _ = hash.Write([]byte(secret))
	return fmt.Sprintf("%x", hash.Sum(nil))
}
