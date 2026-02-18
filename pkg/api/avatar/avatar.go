package avatar

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	lru "github.com/hashicorp/golang-lru/v2/expirable"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type Avatar struct {
	data     []byte
	isCustom bool
}

func (a *Avatar) Encode(wr io.Writer) error {
	_, err := wr.Write(a.data)
	return err
}

func (a *Avatar) GetIsCustom() bool {
	return a.isCustom
}

type AvatarCacheServer struct {
	cfg             *setting.Cfg
	notFound        *Avatar
	cache           *lru.LRU[string, *Avatar]
	logger          log.Logger
	gravatarBaseURL string
	client          *http.Client
}

var (
	looksLikeGravatarHash = regexp.MustCompile("^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})$")

	// Parameters needed to fetch Gravatar with a retro fallback
	gravatarFetchParams = url.Values{"d": {"retro"}, "size": {"200"}, "r": {"pg"}}.Encode()

	// Parameters needed to see if a Gravatar is custom
	gravatarCustomParams = url.Values{"d": {"404"}}.Encode()
)

func (a *AvatarCacheServer) Handler(ctx *contextmodel.ReqContext) {
	hash := web.Params(ctx.Req)[":hash"]

	if !looksLikeGravatarHash.MatchString(hash) {
		ctx.JsonApiErr(404, "Avatar not found", nil)
		return
	}

	avatar := a.GetAvatarForHash(ctx.Req.Context(), hash)

	ctx.Resp.Header().Set("Content-Type", "image/jpeg")

	if !a.cfg.EnableCompression {
		ctx.Resp.Header().Set("Content-Length", strconv.Itoa(len(avatar.data)))
	}

	ctx.Resp.Header().Set("Cache-Control", "private, max-age=3600")

	if err := avatar.Encode(ctx.Resp); err != nil {
		ctx.Logger.Warn("avatar encode error:", "err", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
	}
}

func (a *AvatarCacheServer) GetAvatarForHash(ctx context.Context, hash string) *Avatar {
	if a.cfg.DisableGravatar {
		a.logger.Warn("'GetGravatarForHash' called despite gravatars being disabled; returning default profile image")
		return a.notFound
	}
	return a.getAvatarForHash(ctx, hash)
}

func (a *AvatarCacheServer) getAvatarForHash(ctx context.Context, hash string) *Avatar {
	// This also handles expiration, so if the cache is hit but expired, it will return exists=false with the data.
	avatar, exists := a.cache.Get(hash)
	if exists && avatar != nil {
		return avatar
	}

	avatar, err := a.getAvatarRemote(ctx, hash)
	if err != nil {
		// For any temporary or permanent errors, fall back to the not found image but don't cache it.
		// This avoids poisoning the cache for the full TTL on transient failures.
		a.logger.Debug("get avatar", "err", err)
		return a.notFound
	}

	if evicted := a.cache.Add(hash, avatar); evicted {
		a.logger.Debug("add avatar to cache", "hash", hash, "evicted", evicted)
	}

	return avatar
}

func (a *AvatarCacheServer) getAvatarRemote(ctx context.Context, hash string) (*Avatar, error) {
	fullURL := a.gravatarBaseURL + "/" + hash + "?" + gravatarFetchParams

	avatarData, err := a.performGet(ctx, fullURL)
	if err != nil {
		return nil, fmt.Errorf("failed to get avatar: %w", err)
	}

	isCustom := a.isAvatarCustomRemote(ctx, hash)

	return &Avatar{
		data:     avatarData,
		isCustom: isCustom,
	}, nil
}

func (a *AvatarCacheServer) isAvatarCustomRemote(ctx context.Context, hash string) bool {
	fullURL := a.gravatarBaseURL + "/" + hash + "?" + gravatarCustomParams

	_, err := a.performGet(ctx, fullURL)
	return err == nil
}

func ProvideAvatarCacheServer(cfg *setting.Cfg) *AvatarCacheServer {
	logger := log.New("avatar")
	return &AvatarCacheServer{
		cfg:             cfg,
		notFound:        newNotFound(cfg, logger),
		cache:           lru.NewLRU[string, *Avatar](2000, nil, time.Hour),
		logger:          logger,
		gravatarBaseURL: strings.TrimSuffix(cfg.GravatarURL, "/"),
		client: &http.Client{
			Timeout:   time.Second * 2,
			Transport: &http.Transport{Proxy: http.ProxyFromEnvironment},
		},
	}
}

func newNotFound(cfg *setting.Cfg, logger log.Logger) *Avatar {
	avatar := &Avatar{}

	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from
	// a configuration variable.
	path := filepath.Join(cfg.StaticRootPath, "img", "user_profile.png")
	if data, err := os.ReadFile(path); err != nil { //nolint:gosec
		logger.Error("Failed to read user_profile.png", "path", path)
	} else {
		avatar.data = data
	}

	return avatar
}

func (a *AvatarCacheServer) performGet(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/jpeg,image/png,*/*;q=0.8")
	req.Header.Set("Accept-Encoding", "deflate,sdch")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36")

	a.logger.Debug("Fetching avatar url with parameters", "url", url)

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gravatar unreachable: %w", err)
	}

	defer func() {
		_ = resp.Body.Close()
	}()

	limitedBody := io.LimitReader(resp.Body, 1<<20) // 1MB

	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("status code: %d", resp.StatusCode)
	}

	if resp.ContentLength > 0 {
		data := make([]byte, resp.ContentLength)
		_, err = io.ReadFull(limitedBody, data)
		return data, err
	}

	return io.ReadAll(limitedBody)
}
