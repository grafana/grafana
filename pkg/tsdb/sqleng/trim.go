package sqleng

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// trim trims rows that are outside the qm.TimeRange
func trim(f *data.Frame, qm DataQueryModel) error {
	tsSchema := f.TimeSeriesSchema()
	if tsSchema.Type == data.TimeSeriesTypeNot {
		return fmt.Errorf("can not trim, not timeseries frame")
	}
	timeField := f.Fields[tsSchema.TimeIndex]
	if timeField.Len() == 0 {
		return nil
	}

	for i := timeField.Len() - 1; i >= 0; i-- {
		t, ok := timeField.ConcreteAt(i)
		if !ok {
			return fmt.Errorf("time point is nil")
		}

		if t.(time.Time).After(qm.TimeRange.To) {
			f.DeleteRow(i)
			continue
		}

		break
	}

	for i := 0; i < timeField.Len(); i++ {
		t, ok := timeField.ConcreteAt(i)
		if !ok {
			return fmt.Errorf("time point is nil")
		}

		if !t.(time.Time).Before(qm.TimeRange.From) {
			break
		}

		f.DeleteRow(i)
		// FIXME
		i--
	}

	return nil
}
