package login

import (
	"testing"
)

func TestInitMetrics(t *testing.T) {
	InitMetrics()
	if duplicateUserLogins == nil {
		t.Error("Metrics failed to initialise")
	}
}
