package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana-plugin-sdk-go/transform"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/tsdb"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/xerrors"
)

type TransformPlugin struct {
	PluginBase
	// TODO we probably want a Backend Plugin Base? Or some way to dedup proc management code

	Executable string `json:"executable,omitempty"`

	*TransformWrapper

	client *plugin.Client
	log    log.Logger
}

func (tp *TransformPlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&tp); err != nil {
		return err
	}

	if err := tp.registerPlugin(pluginDir); err != nil {
		return err
	}

	Transform = tp

	return nil
}

func (p *TransformPlugin) startBackendPlugin(ctx context.Context, log log.Logger) error {
	p.log = log.New("plugin-id", p.Id)

	if err := p.spawnSubProcess(); err != nil {
		return err
	}

	go func() {
		if err := p.restartKilledProcess(ctx); err != nil {
			p.log.Error("Attempting to restart killed process failed", "err", err)
		}
	}()

	return nil
}

func (p *TransformPlugin) spawnSubProcess() error {
	cmd := ComposePluginStartCommmand(p.Executable)
	fullpath := path.Join(p.PluginDir, cmd)

	p.client = backendplugin.NewTransformClient(p.Id, fullpath, p.log)

	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	raw, err := rpcClient.Dispense(p.Id)
	if err != nil {
		return err
	}

	plugin, ok := raw.(transform.TransformPlugin)
	if !ok {
		return fmt.Errorf("unexpected type %T, expected *transform.GRPCClient", raw)
	}

	p.TransformWrapper = NewTransformWrapper(p.log, plugin)

	return nil
}

func (p *TransformPlugin) restartKilledProcess(ctx context.Context) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			if err := ctx.Err(); err != nil && !xerrors.Is(err, context.Canceled) {
				return err
			}
			return nil
		case <-ticker.C:
			if !p.client.Exited() {
				continue
			}

			if err := p.spawnSubProcess(); err != nil {
				p.log.Error("Failed to restart plugin", "err", err)
				continue
			}

			p.log.Debug("Plugin process restarted")
		}
	}
}

func (p *TransformPlugin) Kill() {
	if p.client != nil {
		p.log.Debug("Killing subprocess ", "name", p.Name)
		p.client.Kill()
	}
}

// ...
// Wrapper Code
// ...

func NewTransformWrapper(log log.Logger, plugin transform.TransformPlugin) *TransformWrapper {
	return &TransformWrapper{plugin, log, &grafanaAPI{log}}
}

type TransformWrapper struct {
	transform.TransformPlugin
	logger log.Logger
	api    *grafanaAPI
}

func (tw *TransformWrapper) Transform(ctx context.Context, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	pbQuery := &pluginv2.TransformRequest{
		TimeRange: &pluginv2.TimeRange{
			FromRaw:     query.TimeRange.From,
			ToRaw:       query.TimeRange.To,
			ToEpochMs:   query.TimeRange.GetToAsMsEpoch(),
			FromEpochMs: query.TimeRange.GetFromAsMsEpoch(),
		},
		Queries: []*pluginv2.TransformQuery{},
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
		}
		pbQuery.Queries = append(pbQuery.Queries, &pluginv2.TransformQuery{
			ModelJson:     string(modelJSON),
			IntervalMs:    q.IntervalMs,
			RefId:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
		})
	}

	pbres, err := tw.TransformPlugin.Transform(ctx, pbQuery, tw.api)

	if err != nil {
		return nil, err
	}

	res := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	for _, r := range pbres.Results {
		qr := &tsdb.QueryResult{
			RefId: r.RefId,
		}

		if r.Error != "" {
			qr.Error = errors.New(r.Error)
			qr.ErrorString = r.Error
		}

		if r.MetaJson != "" {
			metaJSON, err := simplejson.NewJson([]byte(r.MetaJson))
			if err != nil {
				tw.logger.Error("Error parsing JSON Meta field: " + err.Error())
			}
			qr.Meta = metaJSON
		}
		qr.Dataframes = r.Dataframes

		res.Results[r.RefId] = qr
	}

	return res, nil
}

type grafanaAPI struct {
	logger log.Logger
}

func (s *grafanaAPI) QueryDatasource(ctx context.Context, req *pluginv2.QueryDatasourceRequest) (*pluginv2.QueryDatasourceResponse, error) {
	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("zero queries found in datasource request")
	}

	getDsInfo := &models.GetDataSourceByIdQuery{
		Id:    req.DatasourceId,
		OrgId: req.OrgId,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("Could not find datasource %v", err)
	}

	// Convert plugin-model (datasource) queries to tsdb queries
	queries := make([]*tsdb.Query, len(req.Queries))
	for i, query := range req.Queries {
		sj, err := simplejson.NewJson([]byte(query.ModelJson))
		if err != nil {
			return nil, err
		}
		queries[i] = &tsdb.Query{
			RefId:         query.RefId,
			IntervalMs:    query.IntervalMs,
			MaxDataPoints: query.MaxDataPoints,
			DataSource:    getDsInfo.Result,
			Model:         sj,
		}
	}

	timeRange := tsdb.NewTimeRange(req.TimeRange.FromRaw, req.TimeRange.ToRaw)
	tQ := &tsdb.TsdbQuery{
		TimeRange: timeRange,
		Queries:   queries,
	}

	// Execute the converted queries
	tsdbRes, err := tsdb.HandleRequest(ctx, getDsInfo.Result, tQ)
	if err != nil {
		return nil, err
	}
	// Convert tsdb results (map) to plugin-model/datasource (slice) results
	// Only error and Series responses mapped.
	results := make([]*pluginv2.DatasourceQueryResult, len(tsdbRes.Results))
	resIdx := 0
	for refID, res := range tsdbRes.Results {
		qr := &pluginv2.DatasourceQueryResult{
			RefId: refID,
		}
		if res.Error != nil {
			qr.Error = res.ErrorString
			results[resIdx] = qr
			resIdx++
			continue
		}

		encodedFrames := make([][]byte, len(res.Series))
		for sIdx, series := range res.Series {
			frame, err := tsdb.SeriesToFrame(series)
			if err != nil {
				return nil, err
			}
			encodedFrames[sIdx], err = dataframe.MarshalArrow(frame)
			if err != nil {
				return nil, err
			}
		}
		qr.Dataframes = encodedFrames
		results[resIdx] = qr

		resIdx++
	}
	return &pluginv2.QueryDatasourceResponse{Results: results}, nil
}
