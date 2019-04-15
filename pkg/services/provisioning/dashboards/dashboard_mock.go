package dashboards

import "context"

type Calls struct {
	Provision   []interface{}
	PollChanges []interface{}
}

type DashboardProvisionerMock struct {
	Calls       *Calls
	provision   func() error
	pollChanges func(ctx context.Context) error
}

func NewDashboardProvisionerMock() *DashboardProvisionerMock {
	return &DashboardProvisionerMock{
		Calls: &Calls{},
	}
}

func (dpm *DashboardProvisionerMock) Provision() error {
	dpm.Calls.Provision = append(dpm.Calls.Provision, nil)
	if dpm.provision != nil {
		return dpm.provision()
	} else {
		return nil
	}
}

func (dpm *DashboardProvisionerMock) PollChanges(ctx context.Context) error {
	dpm.Calls.PollChanges = append(dpm.Calls.PollChanges, ctx)
	if dpm.pollChanges != nil {
		return dpm.pollChanges(ctx)
	} else {
		return nil
	}
}
