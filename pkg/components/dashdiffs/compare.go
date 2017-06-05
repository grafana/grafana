package dashdiffs

import (
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	diff "github.com/yudai/gojsondiff"
	deltaFormatter "github.com/yudai/gojsondiff/formatter"
)

type DiffType int

const (
	DiffJSON DiffType = iota
	DiffBasic
	DiffDelta
)

var (
	// ErrUnsupportedDiffType occurs when an invalid diff type is used.
	ErrUnsupportedDiffType = errors.New("dashdiff: unsupported diff type")

	// ErrNilDiff occurs when two compared interfaces are identical.
	ErrNilDiff = errors.New("dashdiff: diff is nil")
)

type Options struct {
	OrgId       int64
	DashboardId int64
	BaseVersion int
	NewVersion  int
	DiffType    DiffType
}

type Result struct {
	Delta []byte `json:"delta"`
}

// CompareDashboardVersionsCommand computes the JSON diff of two versions,
// assigning the delta of the diff to the `Delta` field.
func GetVersionDiff(options *Options) (*Result, error) {
	baseVersionQuery := models.GetDashboardVersionQuery{
		DashboardId: options.DashboardId,
		Version:     options.BaseVersion,
	}

	if err := bus.Dispatch(&baseVersionQuery); err != nil {
		return nil, err
	}

	newVersionQuery := models.GetDashboardVersionQuery{
		DashboardId: options.DashboardId,
		Version:     options.NewVersion,
	}

	if err := bus.Dispatch(&newVersionQuery); err != nil {
		return nil, err
	}

	left, jsonDiff, err := getDiff(baseVersionQuery.Result, newVersionQuery.Result)
	if err != nil {
		return nil, err
	}

	result := &Result{}

	switch options.DiffType {
	case DiffDelta:

		deltaOutput, err := deltaFormatter.NewDeltaFormatter().Format(jsonDiff)
		if err != nil {
			return nil, err
		}
		result.Delta = []byte(deltaOutput)

	case DiffJSON:
		jsonOutput, err := NewJSONFormatter(left).Format(jsonDiff)
		if err != nil {
			return nil, err
		}
		result.Delta = []byte(jsonOutput)

	case DiffBasic:
		basicOutput, err := NewBasicFormatter(left).Format(jsonDiff)
		if err != nil {
			return nil, err
		}
		result.Delta = basicOutput

	default:
		return nil, ErrUnsupportedDiffType
	}

	return result, nil
}

// getDiff computes the diff of two dashboard versions.
func getDiff(originalDash, newDash *models.DashboardVersion) (interface{}, diff.Diff, error) {
	leftBytes, err := simplejson.NewFromAny(originalDash).Encode()
	if err != nil {
		return nil, nil, err
	}

	rightBytes, err := simplejson.NewFromAny(newDash).Encode()
	if err != nil {
		return nil, nil, err
	}

	jsonDiff, err := diff.New().Compare(leftBytes, rightBytes)
	if err != nil {
		return nil, nil, err
	}

	if !jsonDiff.Modified() {
		return nil, nil, ErrNilDiff
	}

	left := make(map[string]interface{})
	err = json.Unmarshal(leftBytes, &left)
	return left, jsonDiff, nil
}
