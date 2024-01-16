package models

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ResultType string

const (
	ResultTypeMatrix   ResultType = "matrix"
	ResultTypeExemplar ResultType = "exemplar"
	ResultTypeVector   ResultType = "vector"
	ResultTypeUnknown  ResultType = ""
)

func ResultTypeFromFrame(frame *data.Frame) ResultType {
	if frame.Meta.Custom == nil {
		return ResultTypeUnknown
	}
	custom, ok := frame.Meta.Custom.(map[string]string)
	if !ok {
		return ResultTypeUnknown
	}

	rt, ok := custom["resultType"]
	if !ok {
		return ResultTypeUnknown
	}

	switch rt {
	case ResultTypeMatrix.String():
		return ResultTypeMatrix
	case ResultTypeExemplar.String():
		return ResultTypeExemplar
	case ResultTypeVector.String():
		return ResultTypeVector
	}

	return ResultTypeUnknown
}

func (r ResultType) String() string {
	return string(r)
}

type Exemplar struct {
	SeriesLabels map[string]string
	Fields       []*data.Field
	RowIdx       int
	Value        float64
	Timestamp    time.Time
}
