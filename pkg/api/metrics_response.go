package api

import (
	"sort"

	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type metricsResponse struct {
	Results results
}

type results map[string]queryResponse

type queryResponse struct {
	Frames data.Frames
	Error  error
	Status int
}

// MarshalJSON writes the results as json
func (m metricsResponse) MarshalJSON() ([]byte, error) {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	writeQueryDataResponseJSON(&m, stream)
	return append([]byte(nil), stream.Buffer()...), stream.Error
}

func writeQueryDataResponseJSON(mr *metricsResponse, stream *jsoniter.Stream) {
	stream.WriteObjectStart()
	stream.WriteObjectField("results")
	stream.WriteObjectStart()
	started := false

	refIDs := []string{}
	for refID := range mr.Results {
		refIDs = append(refIDs, refID)
	}
	sort.Strings(refIDs)

	// Make sure all keys in the result are written
	for _, refID := range refIDs {
		res := mr.Results[refID]

		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField(refID)
		obj := res // avoid implicit memory
		writeDataResponseJSON(&obj, stream)
		started = true
	}
	stream.WriteObjectEnd()

	stream.WriteObjectEnd()
}

func writeDataResponseJSON(dr *queryResponse, stream *jsoniter.Stream) {
	stream.WriteObjectStart()
	started := false

	if dr.Error != nil {
		stream.WriteObjectField("error")
		stream.WriteString(dr.Error.Error())
		started = true
	}

	if dr.Status > 0 {
		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField("status")
		stream.WriteInt(dr.Status)
		started = true
	}

	if dr.Frames != nil {
		if started {
			stream.WriteMore()
		}

		started = false
		stream.WriteObjectField("frames")
		stream.WriteArrayStart()
		for _, frame := range dr.Frames {
			if started {
				stream.WriteMore()
			}
			stream.WriteVal(frame)
			started = true
		}
		stream.WriteArrayEnd()
	}

	stream.WriteObjectEnd()
}
