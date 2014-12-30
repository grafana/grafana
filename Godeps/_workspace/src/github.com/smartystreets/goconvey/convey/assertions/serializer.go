package assertions

import (
	"encoding/json"
	"fmt"

	"github.com/smartystreets/goconvey/convey/reporting"
)

type Serializer interface {
	serialize(expected, actual interface{}, message string) string
}

type failureSerializer struct{}

func (self *failureSerializer) serialize(expected, actual interface{}, message string) string {
	view := reporting.FailureView{
		Message:  message,
		Expected: fmt.Sprintf("%+v", expected),
		Actual:   fmt.Sprintf("%+v", actual),
	}
	serialized, err := json.Marshal(view)
	if err != nil {
		return message
	}
	return string(serialized)
}

func newSerializer() *failureSerializer {
	return &failureSerializer{}
}
