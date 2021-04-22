package push

import (
	"context"
	"errors"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/contexthandler"
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

// Gateway receives data and translates it to Grafana Live publications.
type Gateway struct {
	Cfg         *setting.Cfg      `inject:""`
	GrafanaLive *live.GrafanaLive `inject:""`

	converter   *convert.Converter
	apiKeyCache *apiKeyCache
}

func checkAPIKey(keyString string) (*models.ApiKey, bool, error) {
	apiKey, ok, _, err := contexthandler.CheckAPIKey(keyString, time.Now)
	return apiKey, ok, err
}

// NewGateway creates Gateway.
func NewGateway() *Gateway {
	return &Gateway{
		apiKeyCache: newAPIKeyCache(checkAPIKey, 5*time.Second),
	}
}

// Init Gateway.
func (g *Gateway) Init() error {
	logger.Debug("Live Push Gateway initialization")

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
	return g.apiKeyCache.Run(ctx)
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
	_, ok := g.apiKeyCache.Get(keyString)
	if !ok {
		apiKey, ok, err := checkAPIKey(keyString)
		if err != nil {
			return false, err
		}
		if !ok {
			return false, nil
		}
		g.apiKeyCache.Set(keyString, apiKey.Expires)
	}
	return true, nil
}

func (g *Gateway) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			stack := middleware.Stack(3)
			logger.Error("Request error", "error", r, "stack", string(stack))
			rw.WriteHeader(http.StatusInternalServerError)
		}
	}()
	ok, err := g.isAuthenticated(req)
	if err != nil {
		logger.Error("Error authenticating request", "error", err)
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}
	if !ok {
		rw.WriteHeader(http.StatusUnauthorized)
		return
	}
	g.handleStreamPush(rw, req)
}

func (g *Gateway) handleStreamPush(rw http.ResponseWriter, req *http.Request) {
	streamID := path.Base(req.URL.Path)

	stream, err := g.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(streamID)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		return
	}

	// TODO Grafana 8: decide which formats to use or keep all.
	urlValues := req.URL.Query()
	frameFormat := pushurl.FrameFormatFromValues(urlValues)
	stableSchema := pushurl.StableSchemaFromValues(urlValues)

	body, err := io.ReadAll(req.Body)
	if err != nil {
		logger.Error("Error reading body", "error", err)
		return
	}

	if setting.Env != setting.Prod {
		// Do not log in production as it should be pretty hot path.
		logger.Debug("Live Push request",
			"protocol", "http",
			"streamId", streamID,
			"bodyLen", len(body),
			"stableSchema", stableSchema,
			"frameFormat", frameFormat,
		)
	}

	metricFrames, err := g.converter.Convert(body, frameFormat)
	if err != nil {
		logger.Error("Error converting metrics", "error", err, "frameFormat", frameFormat)
		if errors.Is(err, convert.ErrUnsupportedFrameFormat) {
			rw.WriteHeader(http.StatusBadRequest)
			return
		}
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}

	for _, mf := range metricFrames {
		err := stream.Push(mf.Key(), mf.Frame(), stableSchema)
		if err != nil {
			logger.Error("Error pushing frame", "error", err, "key", mf.Key())
			rw.WriteHeader(http.StatusInternalServerError)
			return
		}
	}

	rw.WriteHeader(http.StatusOK)
	_, _ = rw.Write([]byte(`{}`))
}
