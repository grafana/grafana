package lokihttp

import (
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/loki/logproto"
)

// Entry is a log entry with labels.
type Entry struct {
	Labels model.LabelSet
	logproto.Entry
}
