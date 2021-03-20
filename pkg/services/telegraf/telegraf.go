package telegraf

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("telegraf")
)

func init() {
	registry.RegisterServiceWithPriority(&LiveProxy{}, registry.Low)
}

// LiveProxy proxies metric stream from Telegraf to Grafana Live system.
type LiveProxy struct {
	Cfg             *setting.Cfg             `inject:""`
	RouteRegister   routing.RouteRegister    `inject:""`
	PluginManager   *manager.PluginManager   `inject:""`
	Bus             bus.Bus                  `inject:""`
	CacheService    *localcache.CacheService `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	GrafanaLive     *live.GrafanaLive        `inject:""`
}

// Init LiveProxy.
func (t *LiveProxy) Init() error {
	logger.Info("Telegraf LiveProxy proxy initialization")

	if !t.IsEnabled() {
		logger.Debug("Telegraf LiveProxy feature not enabled, skipping initialization")
		return nil
	}

	var allStreams = make(map[uint64]MetricFrameStream)
	parser := NewInfluxParser()

	//handler := func(ctx *models.ReqContext) {
	//	path := ctx.Params("path")
	//
	//	body, err := ctx.Req.Body().Bytes()
	//	if err != nil {
	//		logger.Error("Error reading body", "error", err)
	//		ctx.Resp.WriteHeader(http.StatusInternalServerError)
	//		return
	//	}
	//	logger.Info("Telegraf body", "body", string(body))
	//
	//	metrics, err := parser.Parse(body)
	//	if err != nil {
	//		logger.Error("Error making metrics", "error", err)
	//		ctx.Resp.WriteHeader(http.StatusInternalServerError)
	//		return
	//	}
	//
	//	created := make(map[uint64]bool)
	//	batch := make(map[string]MetricFrameStream)
	//
	//	for _, m := range metrics {
	//		id := m.HashID()
	//		stream, ok := batch[m.Name()]
	//		if ok {
	//			// Same batch
	//			stream.Append(m)
	//		} else {
	//			stream, ok = allStreams[m.Name()]
	//			if ok {
	//				stream.Clear()
	//				stream.Append(m)
	//			} else {
	//				stream, err = NewMetricFrameStream(m)
	//				if err != nil {
	//					logger.Error("Error making frame", "error", err)
	//					continue
	//				}
	//				allStreams[m.Name()] = stream
	//				created[id] = true // flag for append vs new schema
	//			}
	//			batch[m.Name()] = stream
	//		}
	//	}
	//
	//	for _, v := range batch {
	//		//isNew := created[v.id]
	//		frameData, err := data.FrameToJSON(v.Frame, true, true)
	//		if err != nil {
	//			logger.Error("Error marshaling Frame to JSON", "error", err)
	//			ctx.Resp.WriteHeader(http.StatusInternalServerError)
	//			return
	//		}
	//		channel := fmt.Sprintf("telegraf/%s/%s", path, v.Key)
	//		logger.Debug("publish data to channel", "channel", channel, "data", string(frameData))
	//		err = t.GrafanaLive.Publish(channel, frameData)
	//		if err != nil {
	//			logger.Error("Error publishing to a channel", "error", err, "channel", channel)
	//			ctx.Resp.WriteHeader(http.StatusInternalServerError)
	//			return
	//		}
	//	}
	//}

	handler := func(ctx *models.ReqContext) {
		path := ctx.Params("path")

		body, err := ctx.Req.Body().Bytes()
		if err != nil {
			logger.Error("Error reading body", "error", err)
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}
		logger.Info("Telegraf body", "body", string(body))

		metrics, err := parser.Parse(body)
		if err != nil {
			logger.Error("Error making metrics", "error", err)
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}

		created := make(map[uint64]bool)
		batch := make(map[uint64]MetricFrameStream)

		for _, m := range metrics {
			id := m.HashID()
			stream, ok := batch[id]
			if ok {
				// Same batch
				stream.Append(m)
			} else {
				stream, ok = allStreams[id]
				if ok {
					stream.Clear()
					stream.Append(m)
				} else {
					stream, err = NewMetricFrameStream(m)
					if err != nil {
						logger.Error("Error making frame", "error", err)
						continue
					}
					allStreams[id] = stream
					created[id] = true // flag for append vs new schema
				}
				batch[id] = stream
			}
		}

		for _, v := range batch {
			//isNew := created[v.id]
			frameData, err := data.FrameToJSON(v.Frame, true, true)
			if err != nil {
				logger.Error("Error marshaling Frame to JSON", "error", err)
				ctx.Resp.WriteHeader(http.StatusInternalServerError)
				return
			}
			channel := fmt.Sprintf("telegraf/%s/%s", path, v.Key)
			logger.Debug("publish data to channel", "channel", channel, "data", string(frameData))
			err = t.GrafanaLive.Publish(channel, frameData)
			if err != nil {
				logger.Error("Error publishing to a channel", "error", err, "channel", channel)
				ctx.Resp.WriteHeader(http.StatusInternalServerError)
				return
			}
		}
	}

	t.RouteRegister.Post("/telegraf/live/:path", handler)
	return nil
}

// Run LiveProxy.
func (t *LiveProxy) Run(ctx context.Context) error {
	if !t.IsEnabled() {
		logger.Debug("GrafanaLive feature not enabled, skipping initialization")
		return nil
	}
	<-ctx.Done()
	return ctx.Err()
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (t *LiveProxy) IsEnabled() bool {
	return t.Cfg.IsLiveEnabled() // turn on when Live on for now.
}
