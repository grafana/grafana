package cascadedelete

import (
	"testing"

	"go.uber.org/goleak"
)

func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m,
		goleak.IgnoreTopFunction("github.com/open-feature/go-sdk/openfeature.(*eventExecutor).startEventListener.func1.1"),
	)
}
