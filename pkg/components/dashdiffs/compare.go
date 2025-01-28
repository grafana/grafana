package dashdiffs

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
	diff "github.com/yudai/gojsondiff"
	deltaFormatter "github.com/yudai/gojsondiff/formatter"
)

var (
	// ErrUnsupportedDiffType occurs when an invalid diff type is used.
	ErrUnsupportedDiffType = errors.New("dashdiff: unsupported diff type")
	// ErrNilDiff occurs when two compared interfaces are identical.
	ErrNilDiff = errors.New("dashdiff: diff is nil")
)

type DiffType int

const (
	DiffJSON DiffType = iota
	DiffBasic
	DiffDelta
)

type Options struct {
	OrgId    int64
	Base     DiffTarget
	New      DiffTarget
	DiffType DiffType
}

type DiffTarget struct {
	DashboardId      int64
	Version          int64
	UnsavedDashboard *simplejson.Json
}

type Result struct {
	Delta []byte `json:"delta"`
}

func ParseDiffType(diff string) DiffType {
	switch diff {
	case "json":
		return DiffJSON
	case "basic":
		return DiffBasic
	case "delta":
		return DiffDelta
	}
	return DiffBasic
}

// CompareDashboardVersionsCommand computes the JSON diff of two versions,
// assigning the delta of the diff to the `Delta` field.
func CalculateDiff(ctx context.Context, options *Options, baseData, newData *simplejson.Json) (*Result, error) {
	left, jsonDiff, err := getDiff(baseData, newData)
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
func getDiff(baseData, newData *simplejson.Json) (any, diff.Diff, error) {
	leftBytes, err := baseData.Encode()
	if err != nil {
		return nil, nil, err
	}

	rightBytes, err := newData.Encode()
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

	left := make(map[string]any)
	err = json.Unmarshal(leftBytes, &left)
	if err != nil {
		return nil, nil, err
	}

	return left, jsonDiff, nil
}
