package historian

import (
	"context"
	"fmt"
	"strconv"
	"time"

	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/lokiclient"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	historianModels "github.com/grafana/grafana/pkg/services/ngalert/schedule/historian/models"
)

var json = jsoniter.ConfigCompatibleWithStandardLibrary

const (
	LokiClientSpanName  = "ngalert.evaluation-historian.client"
	historyWriteTimeout = time.Minute
	historyKey          = "from"
	historyLabelValue   = "evaluation-history"
	orgIDLabel          = "orgID"
	groupLabel          = "group"
	folderUIDLabel      = "folderUID"
)

type entry struct {
	SchemaVersion  int    `json:"schemaVersion"`
	RuleUID        string `json:"ruleUID"`
	Version        string `json:"version"`
	EvaluationTime int64  `json:"evaluationTime"`
	FingerPrint    string `json:"fingerprint"`
	Attempt        int64  `json:"attempt"`
	Error          string `json:"error,omitempty"`
	Duration       int64  `json:"duration"`
	Status         string `json:"status"`
}

type LokiClient interface {
	Push(context.Context, []lokiclient.Stream) error
}

type Historian struct {
	client         LokiClient
	externalLabels map[string]string
	metrics        *metrics.EvalHistorian
	log            log.Logger
	timeout        time.Duration
}

func NewHistorian(
	logger log.Logger,
	lokiClient LokiClient,
	metrics *metrics.EvalHistorian,
	externalLabels map[string]string,
	timeout time.Duration,
) *Historian {
	if timeout <= 0 {
		timeout = historyWriteTimeout
	}
	return &Historian{
		client:         lokiClient,
		externalLabels: externalLabels,
		metrics:        metrics,
		log:            logger,
		timeout:        timeout,
	}
}

func (h *Historian) Record(ctx context.Context, opts historianModels.Record) {
	logger := h.log.FromContext(ctx)
	stream := h.prepareStream(opts, logger)
	if len(stream) == 0 {
		return
	}
	org := fmt.Sprint(opts.GroupKey.OrgID)

	writeCtx, cancel := context.WithTimeout(ctx, h.timeout)
	defer cancel()
	defer h.metrics.WritesTotal.WithLabelValues(org).Inc()

	err := h.client.Push(writeCtx, stream)
	if err != nil {
		logger.Error("Failed to save evaluation history", "error", err)
		h.metrics.WritesFailed.WithLabelValues(org).Inc()
	}
}

func (h *Historian) prepareStream(record historianModels.Record, logger log.Logger) []lokiclient.Stream {
	entry := entry{
		SchemaVersion:  1,
		RuleUID:        record.RuleUID,
		Version:        strconv.FormatInt(record.RuleVersion, 10),
		FingerPrint:    record.RuleFingerprint,
		Attempt:        int64(record.Attempt),
		Duration:       record.Duration.Milliseconds(),
		Status:         string(record.Status),
		Error:          record.Error,
		EvaluationTime: record.EvaluationTime.Unix(),
	}

	entryJSON, err := json.Marshal(entry)
	if err != nil {
		logger.Error("Failed to convert to stream", "error", err)
		return nil
	}

	streamLabels := make(map[string]string)
	for k, v := range h.externalLabels {
		streamLabels[k] = v
	}
	streamLabels[historyKey] = historyLabelValue
	streamLabels[orgIDLabel] = fmt.Sprint(record.GroupKey.OrgID)
	streamLabels[groupLabel] = fmt.Sprint(record.GroupKey.RuleGroup)
	streamLabels[folderUIDLabel] = fmt.Sprint(record.GroupKey.NamespaceUID)

	return []lokiclient.Stream{
		{
			Stream: streamLabels,
			Values: []lokiclient.Sample{
				{
					T: record.Tick,
					V: string(entryJSON),
				}},
		},
	}
}
