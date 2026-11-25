package dashboardpreferencestest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards/dashboardpreferences"
)

var _ dashboardpreferences.UserCleaner = (*FakeUserCleaner)(nil)

type FakeUserCleaner struct {
	ExpectedError error
	// Calls holds "<namespace>/<userUID>" for each delete, in order.
	Calls []string
}

func (f *FakeUserCleaner) DeleteUserPreferences(_ context.Context, namespace, userUID string) error {
	f.Calls = append(f.Calls, namespace+"/"+userUID)
	return f.ExpectedError
}
