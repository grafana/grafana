package users

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestNotificationAsConfig(t *testing.T) {
	logger := log.New("fake.log")

	// TODO: Add some tests if the rest of the code looks fine
	logger.Crit("No tests!")
}
