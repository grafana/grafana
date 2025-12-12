package historian

import (
	"context"
	"time"

	"github.com/grafana/alerting/notify/historian/lokiclient"

	alertingInstrument "github.com/grafana/alerting/http/instrument"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

const (
	OrgIDLabel     = "orgID"
	RuleUIDLabel   = "ruleUID"
	GroupLabel     = "group"
	FolderUIDLabel = "folderUID"
	// Name of the columns used in the dataframe.
	dfTime   = "time"
	dfLine   = "line"
	dfLabels = "labels"
)

const (
	StateHistoryLabelKey   = "from"
	StateHistoryLabelValue = "state-history"
	LokiClientSpanName     = "ngalert.historian.client"
)

const defaultQueryRange = 6 * time.Hour

type remoteLokiClient interface {
	Ping(context.Context) error
	Push(context.Context, []lokiclient.Stream) error
	RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (lokiclient.QueryRes, error)
	MaxQuerySize() int
}

// RemoteLokibackend is a state.Historian that records state history to an external Loki instance.
type RemoteLokiBackend struct {
	*LokiWriter
	*LokiReader
}

func NewRemoteLokiBackend(logger log.Logger, cfg lokiclient.LokiConfig, req alertingInstrument.Requester, metrics *metrics.Historian, tracer tracing.Tracer, ruleStore RuleStore, ac AccessControl) *RemoteLokiBackend {
	return &RemoteLokiBackend{
		LokiWriter: NewLokiWriter(logger, cfg, req, metrics, tracer),
		LokiReader: NewLokiReader(logger, cfg, req, metrics, tracer, ruleStore, ac),
	}
}

type LokiEntry struct {
	SchemaVersion int              `json:"schemaVersion"`
	Previous      string           `json:"previous"`
	Current       string           `json:"current"`
	Error         string           `json:"error,omitempty"`
	Values        *simplejson.Json `json:"values"`
	Condition     string           `json:"condition"`
	DashboardUID  string           `json:"dashboardUID"`
	PanelID       int64            `json:"panelID"`
	Fingerprint   string           `json:"fingerprint"`
	RuleTitle     string           `json:"ruleTitle"`
	RuleID        int64            `json:"ruleID"`
	RuleUID       string           `json:"ruleUID"`
	// InstanceLabels is exactly the set of labels associated with the alert instance in Alertmanager.
	// These should not be conflated with labels associated with log streams.
	InstanceLabels map[string]string `json:"labels"`
}
