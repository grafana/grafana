package dashboards

import "context"

type Calls struct {
	Provision                   []interface{}
	PollChanges                 []interface{}
	GetProvisionerResolvedPath  []interface{}
	GetAllowUiUpdatesFromConfig []interface{}
}

type DashboardProvisionerMock struct {
	Calls                           *Calls
	ProvisionFunc                   func() error
	PollChangesFunc                 func(ctx context.Context)
	GetProvisionerResolvedPathFunc  func(name string) string
	GetAllowUiUpdatesFromConfigFunc func(name string) bool
}

func NewDashboardProvisionerMock() *DashboardProvisionerMock {
	return &DashboardProvisionerMock{
		Calls: &Calls{},
	}
}

func (dpm *DashboardProvisionerMock) Provision() error {
	dpm.Calls.Provision = append(dpm.Calls.Provision, nil)
	if dpm.ProvisionFunc != nil {
		return dpm.ProvisionFunc()
	}
	return nil
}

func (dpm *DashboardProvisionerMock) PollChanges(ctx context.Context) {
	dpm.Calls.PollChanges = append(dpm.Calls.PollChanges, ctx)
	if dpm.PollChangesFunc != nil {
		dpm.PollChangesFunc(ctx)
	}
}

func (dpm *DashboardProvisionerMock) GetProvisionerResolvedPath(name string) string {
	dpm.Calls.GetProvisionerResolvedPath = append(dpm.Calls.GetProvisionerResolvedPath, name)
	if dpm.GetProvisionerResolvedPathFunc != nil {
		return dpm.GetProvisionerResolvedPathFunc(name)
	}
	return ""
}

func (dpm *DashboardProvisionerMock) GetAllowUiUpdatesFromConfig(name string) bool {
	dpm.Calls.GetAllowUiUpdatesFromConfig = append(dpm.Calls.GetAllowUiUpdatesFromConfig, name)
	if dpm.GetAllowUiUpdatesFromConfigFunc != nil {
		return dpm.GetAllowUiUpdatesFromConfigFunc(name)
	}
	return false
}
