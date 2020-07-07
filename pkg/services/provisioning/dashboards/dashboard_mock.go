package dashboards

import "context"

// Calls is a mock implementation of the provisioner interface
type calls struct {
	Provision                   []interface{}
	PollChanges                 []interface{}
	GetProvisionerResolvedPath  []interface{}
	GetAllowUIUpdatesFromConfig []interface{}
}

// ProvisionerMock is a mock implementation of `Provisioner`
type ProvisionerMock struct {
	Calls                           *calls
	ProvisionFunc                   func() error
	PollChangesFunc                 func(ctx context.Context)
	GetProvisionerResolvedPathFunc  func(name string) string
	GetAllowUIUpdatesFromConfigFunc func(name string) bool
}

// NewDashboardProvisionerMock returns a new dashboardprovisionermock
func NewDashboardProvisionerMock() *ProvisionerMock {
	return &ProvisionerMock{
		Calls: &calls{},
	}
}

// Provision is a mock implementation of `Provisioner.Provision`
func (dpm *ProvisionerMock) Provision() error {
	dpm.Calls.Provision = append(dpm.Calls.Provision, nil)
	if dpm.ProvisionFunc != nil {
		return dpm.ProvisionFunc()
	}
	return nil
}

// PollChanges is a mock implementation of `Provisioner.PollChanges`
func (dpm *ProvisionerMock) PollChanges(ctx context.Context) {
	dpm.Calls.PollChanges = append(dpm.Calls.PollChanges, ctx)
	if dpm.PollChangesFunc != nil {
		dpm.PollChangesFunc(ctx)
	}
}

// GetProvisionerResolvedPath is a mock implementation of `Provisioner.GetProvisionerResolvedPath`
func (dpm *ProvisionerMock) GetProvisionerResolvedPath(name string) string {
	dpm.Calls.GetProvisionerResolvedPath = append(dpm.Calls.GetProvisionerResolvedPath, name)
	if dpm.GetProvisionerResolvedPathFunc != nil {
		return dpm.GetProvisionerResolvedPathFunc(name)
	}
	return ""
}

// GetAllowUIUpdatesFromConfig is a mock implementation of `Provisioner.GetAllowUIUpdatesFromConfig`
func (dpm *ProvisionerMock) GetAllowUIUpdatesFromConfig(name string) bool {
	dpm.Calls.GetAllowUIUpdatesFromConfig = append(dpm.Calls.GetAllowUIUpdatesFromConfig, name)
	if dpm.GetAllowUIUpdatesFromConfigFunc != nil {
		return dpm.GetAllowUIUpdatesFromConfigFunc(name)
	}
	return false
}
