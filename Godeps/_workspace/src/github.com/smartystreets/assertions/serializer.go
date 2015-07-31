package assertions

import (
	"encoding/json"
	"fmt"

	"github.com/smartystreets/goconvey/convey/reporting"
)

type Serializer interface {
	serialize(expected, actual interface{}, message string) string
	serializeDetailed(expected, actual interface{}, message string) string
}

type failureSerializer struct{}

func (self *failureSerializer) serializeDetailed(expected, actual interface{}, message string) string {
	view := self.format(expected, actual, message, "%#v")
	serialized, err := json.Marshal(view)
	if err != nil {
		return message
	}
	return string(serialized)
}

func (self *failureSerializer) serialize(expected, actual interface{}, message string) string {
	view := self.format(expected, actual, message, "%+v")
	serialized, err := json.Marshal(view)
	if err != nil {
		return message
	}
	return string(serialized)
}

func (self *failureSerializer) format(expected, actual interface{}, message string, format string) reporting.FailureView {
	return reporting.FailureView{
		Message:  message,
		Expected: fmt.Sprintf(format, expected),
		Actual:   fmt.Sprintf(format, actual),
	}
}

func newSerializer() *failureSerializer {
	return &failureSerializer{}
}

///////////////////////////////////////////////////////

// noopSerializer just gives back the original message. This is useful when we are using
// the assertions from a context other than the web UI, that requires the JSON structure
// provided by the failureSerializer.
type noopSerializer struct{}

func (self *noopSerializer) serialize(expected, actual interface{}, message string) string {
	return message
}
func (self *noopSerializer) serializeDetailed(expected, actual interface{}, message string) string {
	return message
}
