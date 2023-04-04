package expr

import (
	"errors"
	"fmt"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/dataplane/sdata/reader"
	"github.com/grafana/dataplane/sdata/timeseries"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

func shouldUseDataplane(frames data.Frames) (k data.FrameTypeKind, b bool, e error) {
	k = data.KindUnknown
	if len(frames) == 0 {
		return data.KindUnknown, true, nil
	}

	firstFrame := frames[0]
	if firstFrame == nil {
		return
	}

	if firstFrame.Meta == nil {
		return
	}

	if firstFrame.Meta.Type == "" {
		return
	}

	if firstFrame.Meta.TypeVersion.IsZero() {
		return
	}

	k, err := reader.CanReadBasedOnMeta(frames)
	if err != nil {
		var vw *sdata.VersionWarning
		if errors.As(err, &vw) {
			return k, true, err
		}
		return k, false, err
	}
	return k, true, nil
}

func handleDataplaneFrames(k data.FrameTypeKind, frames data.Frames) (mathexp.Results, error) {
	switch k {
	case data.KindUnknown:
		return mathexp.Results{Values: mathexp.Values{mathexp.NoData{}.New()}}, nil
	case data.KindTimeSeries:
		return handleDataplaneTS(frames)
	case data.KindNumeric:
		return handleDataplaneNumeric(frames)
	}
	return mathexp.Results{}, fmt.Errorf("kind %s not supported by server side expressions", k)
}

func handleDataplaneTS(frames data.Frames) (mathexp.Results, error) {
	dps, err := timeseries.CollectionReaderFromFrames(frames)
	if err != nil {
		return mathexp.Results{}, err
	}
	sc, err := dps.GetCollection(false)
	if err != nil {
		return mathexp.Results{}, err
	}
	res := mathexp.Results{}
	res.Values = make([]mathexp.Value, 0, len(sc.Refs))
	for _, s := range sc.Refs {
		newSeries, err := mathexp.NewSeriesFromRef(sc.RefID, s)
		if err != nil {
			return res, err
		}
		res.Values = append(res.Values, newSeries)
	}

	return res, nil
}

func handleDataplaneNumeric(frames data.Frames) (mathexp.Results, error) {
	dn, err := numeric.CollectionReaderFromFrames(frames)
	if err != nil {
		return mathexp.Results{}, err
	}
	nc, err := dn.GetCollection(false)
	if err != nil {
		return mathexp.Results{}, err
	}
	res := mathexp.Results{}
	res.Values = make([]mathexp.Value, 0, len(nc.Refs))
	for _, n := range nc.Refs {
		newNum, err := mathexp.NumberFromRef(nc.RefID, n)
		if err != nil {
			return res, err
		}
		res.Values = append(res.Values, newNum)
	}

	return res, nil
}
