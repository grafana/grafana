package api

import (
	amconfig "github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func ModelToMuteTimeIntervals(intervals []v1.TimeInterval) []definitions.MuteTimeInterval {
	out := make([]definitions.MuteTimeInterval, 0, len(intervals))
	for _, interval := range intervals {
		out = append(out, ModelToMuteTimeInterval(interval))
	}
	return out
}

func ModelToMuteTimeInterval(interval v1.TimeInterval) definitions.MuteTimeInterval {
	return definitions.MuteTimeInterval{
		UID: string(interval.UID),
		MuteTimeInterval: amconfig.MuteTimeInterval{
			Name:          interval.Title,
			TimeIntervals: interval.TimeIntervals,
		},
		Version:    interval.Version,
		Provenance: definitions.Provenance(interval.Provenance),
	}
}

func MuteTimeIntervalToModel(mt definitions.MuteTimeInterval) v1.TimeInterval {
	return v1.TimeInterval{
		ResourceMetadata: v1.ResourceMetadata{
			UID:        v1.ResourceUID(mt.UID),
			Version:    mt.Version,
			Provenance: models.Provenance(mt.Provenance),
		},
		Title:         mt.Name,
		TimeIntervals: mt.TimeIntervals,
	}
}
