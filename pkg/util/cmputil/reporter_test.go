package cmputil

import (
	"math/rand"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util"
)

type subStruct struct {
	Data interface{}
}

type testStruct struct {
	Number       float64
	NumberPtr    *float64
	Text         string
	TextPtr      *string
	Flag         bool
	FlagPtr      *bool
	Dict         map[float64]float64
	Slice        []float64
	SubStruct    subStruct
	SubStructPtr *subStruct
}

func testStructDiff(left, right testStruct) DiffReport {
	var reporter DiffReporter
	ops := make([]cmp.Option, 0, 4)
	ops = append(ops, cmp.Reporter(&reporter))
	cmp.Equal(left, right, ops...)
	return reporter.Diffs
}

func TestIsAddedDeleted_Collections(t *testing.T) {
	testCases := []struct {
		name  string
		left  testStruct
		right testStruct
		field string
	}{
		{
			name: "nil vs non-empty slice",
			left: testStruct{
				Slice: nil,
			},
			right: testStruct{
				Slice: []float64{rand.Float64()},
			},
			field: "Slice",
		},
		{
			name: "empty vs non-empty slice",
			left: testStruct{
				Slice: []float64{},
			},
			right: testStruct{
				Slice: []float64{rand.Float64()},
			},
			field: "Slice",
		},
		{
			name: "nil vs non-empty map",
			left: testStruct{
				Dict: nil,
			},
			right: testStruct{
				Dict: map[float64]float64{rand.Float64(): rand.Float64()},
			},
			field: "Slice",
		},
		{
			name: "empty vs non-empty map",
			left: testStruct{
				Dict: map[float64]float64{},
			},
			right: testStruct{
				Dict: map[float64]float64{rand.Float64(): rand.Float64()},
			},
			field: "Slice",
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			left := testCase.left
			right := testCase.right
			field := testCase.field
			t.Run("IsAddOperation=true, IsDeleted=false", func(t *testing.T) {
				diff := testStructDiff(left, right)
				require.Lenf(t, diff, 1, "diff was expected to have only one field %s but got %v", field, diff.String())
				d := diff[0]
				require.Truef(t, d.IsAddOperation(), "diff %v should be treated as Add operation but it wasn't", d)
				require.Falsef(t, d.IsDeleteOperation(), "diff %v should not be treated as Delete operation but it was", d)
			})
			t.Run("IsDeleted=true, IsAddOperation=false", func(t *testing.T) {
				diff := testStructDiff(right, left)
				require.Lenf(t, diff, 1, "diff was expected to have only one field %s but got %v", field, diff.String())
				d := diff[0]
				require.Truef(t, d.IsDeleteOperation(), "diff %v should be treated as Delete operation but it wasn't", d)
				require.Falsef(t, d.IsAddOperation(), "diff %v should not be treated as Delete operation but it was", d)
			})
		})
	}

	t.Run("IsAddOperation=false, IsDeleted=false if changes in struct fields", func(t *testing.T) {
		left := testStruct{}
		right := testStruct{
			Number:    rand.Float64(),
			NumberPtr: util.Pointer(rand.Float64()),
			Text:      util.GenerateShortUID(),
			TextPtr:   util.Pointer(util.GenerateShortUID()),
			Flag:      true,
			FlagPtr:   util.Pointer(true),
			SubStruct: subStruct{
				Data: rand.Float64(),
			},
			SubStructPtr: &subStruct{Data: rand.Float64()},
		}

		diff := testStructDiff(left, right)
		require.Len(t, diff, 8)
		for _, d := range diff {
			assert.Falsef(t, d.IsAddOperation(), "diff %v was not supposed to be Add operation", d.String())
			assert.Falsef(t, d.IsDeleteOperation(), "diff %v was not supposed to be Delete operation", d.String())
		}
	})
}

func TestGetDiffsForField(t *testing.T) {
	t.Run("should not include fields that starts has prefix", func(t *testing.T) {
		diff := DiffReport{
			Diff{
				Path: "Property",
			},
			Diff{
				Path: "PropertyData",
			},
		}

		result := diff.GetDiffsForField("Property")
		require.Len(t, result, 1)
		require.Equal(t, "Property", result[0].Path)
	})

	t.Run("should return all changes by parent path", func(t *testing.T) {
		diff := DiffReport{
			Diff{
				Path: "Property.Data.Value",
			},
			Diff{
				Path: "Property.Array[0].Value",
			},
		}

		result := diff.GetDiffsForField("Property")
		require.Len(t, result, 2)
	})

	t.Run("should return all elements of array", func(t *testing.T) {
		diff := DiffReport{
			Diff{
				Path: "Property[0].Data.Test",
			},
			Diff{
				Path: "Property",
			},
			Diff{
				Path: "Property[1]",
			},
		}

		result := diff.GetDiffsForField("Property")
		require.Len(t, result, 3)
	})

	t.Run("should find nothing if parent path does not exist", func(t *testing.T) {
		diff := DiffReport{
			Diff{
				Path: "Property[0].Data.Test",
			},
			Diff{
				Path: "Property",
			},
			Diff{
				Path: "Property[1]",
			},
		}

		result := diff.GetDiffsForField("Proper")
		require.Empty(t, result)
	})
}
