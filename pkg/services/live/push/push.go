package push

import (
	"context"
	"errors"
	"io/ioutil"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/pushurl"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("live_push")
)

func init() {
	registry.RegisterServiceWithPriority(NewGateway(), registry.Low)
}

// CachedKey ...
type CachedKey struct {
	IsValid   bool
	CheckedAt time.Time
}

// Gateway receives data and translates it to Grafana Live publications.
type Gateway struct {
	Cfg         *setting.Cfg      `inject:""`
	GrafanaLive *live.GrafanaLive `inject:""`

	converter *convert.Converter

	// TODO: need to periodically invalidate this cache in separate goroutine.
	keyMu    sync.RWMutex
	keyCache map[string]CachedKey
}

func NewGateway() *Gateway {
	return &Gateway{
		keyCache: map[string]CachedKey{},
	}
}

// Init Gateway.
func (g *Gateway) Init() error {
	logger.Info("Live Push Gateway initialization")

	if !g.IsEnabled() {
		logger.Debug("Live Push Gateway not enabled, skipping initialization")
		return nil
	}

	g.converter = convert.NewConverter()
	return nil
}

// Run Gateway.
func (g *Gateway) Run(ctx context.Context) error {
	if !g.IsEnabled() {
		logger.Debug("GrafanaLive feature not enabled, skipping initialization of Live Push Gateway")
		return nil
	}
	<-ctx.Done()
	return ctx.Err()
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (g *Gateway) IsEnabled() bool {
	return g.Cfg.IsLiveEnabled() // turn on when Live on for now.
}

func extractKey(req *http.Request) string {
	header := req.Header.Get("Authorization")
	parts := strings.SplitN(header, " ", 2)
	var keyString string
	if len(parts) == 2 && parts[0] == "Bearer" {
		keyString = parts[1]
	}
	return keyString
}

func (g *Gateway) isAuthenticated(req *http.Request) (bool, error) {
	keyString := extractKey(req)
	if keyString == "" {
		return false, nil
	}
	g.keyMu.RLock()
	existingKey, ok := g.keyCache[keyString]
	g.keyMu.RUnlock()
	if !ok {
		// TODO: share the code below with middleware package.
		decoded, err := apikeygen.Decode(keyString)
		if err != nil {
			return false, nil
		}
		keyQuery := models.GetApiKeyByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
		if err := bus.Dispatch(&keyQuery); err != nil {
			if errors.Is(err, models.ErrInvalidApiKey) {
				return false, nil
			}
			return false, err
		}
		apikey := keyQuery.Result
		// validate api key.
		isValid, err := apikeygen.IsValid(decoded, apikey.Key)
		if err != nil {
			return false, nil
		}
		if !isValid {
			return false, nil
		}

		now := time.Now()

		if apikey.Expires != nil && *apikey.Expires <= now.Unix() {
			return false, nil
		}
		g.keyMu.Lock()
		g.keyCache[keyString] = CachedKey{CheckedAt: now, IsValid: true}
		g.keyMu.Unlock()
	} else {
		if !existingKey.IsValid {
			g.keyMu.Lock()
			delete(g.keyCache, keyString)
			g.keyMu.Unlock()
			return false, nil
		}
	}
	return true, nil
}

func (g *Gateway) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	ok, err := g.isAuthenticated(req)
	if err != nil {
		logger.Error("Error authenticating push request", "error", err)
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}
	if !ok {
		rw.WriteHeader(http.StatusUnauthorized)
		return
	}
	// TODO: properly extract streamID.
	streamID := "telegraf"
	g.handleStreamPush(req, streamID)
	rw.WriteHeader(http.StatusOK)
}

func (g *Gateway) handleStreamPush(req *http.Request, streamID string) {
	// TODO: return errors to caller.

	stream, err := g.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(streamID)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		return
	}

	// TODO Grafana 8: decide which formats to use or keep all.
	urlValues := req.URL.Query()
	frameFormat := pushurl.FrameFormatFromValues(urlValues)
	stableSchema := pushurl.StableSchemaFromValues(urlValues)

	body, err := ioutil.ReadAll(req.Body)
	if err != nil {
		logger.Error("Error reading body", "error", err)
		return
	}
	logger.Debug("Live Push request",
		"protocol", "http",
		"streamId", streamID,
		"bodyLength", len(body),
		"stableSchema", stableSchema,
		"frameFormat", frameFormat,
	)

	metricFrames, err := g.converter.Convert(body, frameFormat)
	if err != nil {
		logger.Error("Error converting metrics", "error", err, "frameFormat", frameFormat)
		if errors.Is(err, convert.ErrUnsupportedFrameFormat) {
			//ctx.Resp.WriteHeader(http.StatusBadRequest)
		} else {
			//ctx.Resp.WriteHeader(http.StatusInternalServerError)
		}
		return
	}

	// TODO -- make sure all packets are combined together!
	// interval = "1s" vs flush_interval = "5s"

	for _, mf := range metricFrames {
		err := stream.Push(mf.Key(), mf.Frame(), stableSchema)
		if err != nil {
			//ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}
	}
}
