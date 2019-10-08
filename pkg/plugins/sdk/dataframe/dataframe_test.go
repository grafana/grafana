package dataframe_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/grafana/pkg/plugins/sdk/dataframe"
)

func TestDataFrame(t *testing.T) {
	df := dataframe.New("http_requests_total", dataframe.Labels{"service": "auth"},
		dataframe.NewField("timestamp", dataframe.FieldTypeTime, []time.Time{time.Now(), time.Now(), time.Now()}),
		dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{1.0, 2.0, 3.0}),
		dataframe.NewField("category", dataframe.FieldTypeString, []string{"foo", "bar", "test"}),
		dataframe.NewField("valid", dataframe.FieldTypeBoolean, []bool{true, false, true}),
	)

	if df.Rows() != 3 {
		t.Fatal("unexpected length")
	}
}

func TestField(t *testing.T) {
	f := dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{1.0, 2.0, 3.0})

	if f.Len() != 3 {
		t.Fatal("unexpected length")
	}
}

func TestField_Float64(t *testing.T) {
	f := dataframe.NewField("value", dataframe.FieldTypeNumber, make([]*float64, 3))

	want := 2.0
	f.Vector.Set(1, &want)

	if f.Len() != 3 {
		t.Fatal("unexpected length")
	}

	got := f.Vector.At(1).(*float64)

	if *got != want {
		t.Errorf("%+v", *got)
	}
}

func TestField_String(t *testing.T) {
	f := dataframe.NewField("value", dataframe.FieldTypeString, make([]*string, 3))

	want := "foo"
	f.Vector.Set(1, &want)

	if f.Len() != 3 {
		t.Fatal("unexpected length")
	}

	got := f.Vector.At(1).(*string)

	if *got != want {
		t.Errorf("%+v", *got)
	}
}

func TestTimeField(t *testing.T) {
	tests := []struct {
		Type   dataframe.FieldType
		Values []*time.Time
	}{
		{
			Type:   dataframe.FieldTypeTime,
			Values: []*time.Time{timePtr(time.Unix(111, 0))},
		},
		{
			Type:   dataframe.FieldTypeTime,
			Values: []*time.Time{nil, timePtr(time.Unix(111, 0))},
		},
		{
			Type:   dataframe.FieldTypeTime,
			Values: []*time.Time{nil, timePtr(time.Unix(111, 0)), nil},
		},
		{
			Type:   dataframe.FieldTypeTime,
			Values: make([]*time.Time, 10),
		},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			f := dataframe.NewField(t.Name(), tt.Type, tt.Values)

			if f.Len() != len(tt.Values) {
				t.Error(f.Len())
			}

			for i := 0; i < f.Len(); i++ {
				got := reflect.ValueOf(f.Vector.At(i))
				want := reflect.ValueOf(tt.Values[i])

				if got != want {
					t.Error(got, want)
				}
			}

		})
	}
}

func TestField_WrongType(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("expected test to panic, but it didn't")
		}
	}()

	dataframe.NewField("foo", dataframe.FieldTypeNumber, []string{"bar"})
}

func timePtr(t time.Time) *time.Time {
	return &t
}
