package sqleng

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// trim trims rows that are outside the qm.TimeRange.
func trim(f *data.Frame, qm dataQueryModel) error {
	tsSchema := f.TimeSeriesSchema()
	if tsSchema.Type == data.TimeSeriesTypeNot {
		return fmt.Errorf("can not trim non-timeseries frame")
	}

	timeField := f.Fields[tsSchema.TimeIndex]
	if timeField.Len() == 0 {
		return nil
	}

	// Trim rows after end
	for i := timeField.Len() - 1; i >= 0; i-- {
		t, ok := timeField.ConcreteAt(i)
		if !ok {
			return fmt.Errorf("time point is nil")
		}

		if !t.(time.Time).After(qm.TimeRange.To) {
			break
		}

		f.DeleteRow(i)
	}

	// Trim rows before start
	for timeField.Len() > 0 {
		t, ok := timeField.ConcreteAt(0)
		if !ok {
			return fmt.Errorf("time point is nil")
		}

		if !t.(time.Time).Before(qm.TimeRange.From) {
			break
		}

		f.DeleteRow(0)
	}

	return nil
}
