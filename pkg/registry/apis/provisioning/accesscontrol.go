package provisioning

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	// Repositories
	ActionProvisioningRepositoriesCreate = "provisioning.repositories:create" // CREATE.
	ActionProvisioningRepositoriesWrite  = "provisioning.repositories:write"  // UPDATE.
	ActionProvisioningRepositoriesRead   = "provisioning.repositories:read"   // GET + LIST.
	ActionProvisioningRepositoriesDelete = "provisioning.repositories:delete" // DELETE.

	// Jobs
	ActionProvisioningJobsCreate = "provisioning.jobs:create" // CREATE.
	ActionProvisioningJobsWrite  = "provisioning.jobs:write"  // UPDATE.
	ActionProvisioningJobsRead   = "provisioning.jobs:read"   // GET + LIST.
	ActionProvisioningJobsDelete = "provisioning.jobs:delete" // DELETE.

	// Historic Jobs
	ActionProvisioningHistoricJobsRead = "provisioning.historicjobs:read" // GET + LIST.
)

var (
	ScopeProviderProvisioningRepositories = accesscontrol.NewScopeProvider("provisioning.repositories")
	ScopeProviderProvisioningJobs         = accesscontrol.NewScopeProvider("provisioning.jobs")
	ScopeProviderProvisioningHistoricJobs = accesscontrol.NewScopeProvider("provisioning.historicjobs")

	ScopeAllRepositories = ScopeProviderProvisioningRepositories.GetResourceAllScope()
	ScopeAllJobs         = ScopeProviderProvisioningJobs.GetResourceAllScope()
	ScopeAllHistoricJobs = ScopeProviderProvisioningHistoricJobs.GetResourceAllScope()
)

func registerAccessControlRoles(service accesscontrol.Service) error {
	// Repositories
	repositoriesReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.repositories:reader",
			DisplayName: "Repositories Reader",
			Description: "Read and list provisioning repositories.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningRepositoriesRead,
					Scope:  ScopeAllRepositories,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	repositoriesWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.repositories:writer",
			DisplayName: "Repositories Writer",
			Description: "Create, update and delete provisioning repositories.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningRepositoriesCreate,
					Scope:  ScopeAllRepositories,
				},
				{
					Action: ActionProvisioningRepositoriesRead,
					Scope:  ScopeAllRepositories,
				},
				{
					Action: ActionProvisioningRepositoriesWrite,
					Scope:  ScopeAllRepositories,
				},
				{
					Action: ActionProvisioningRepositoriesDelete,
					Scope:  ScopeAllRepositories,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	// Jobs
	jobsReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.jobs:reader",
			DisplayName: "Jobs Reader",
			Description: "Read and list provisioning jobs.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningJobsRead,
					Scope:  ScopeAllJobs,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	jobsWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.jobs:writer",
			DisplayName: "Jobs Writer",
			Description: "Create, update and delete provisioning jobs.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningJobsCreate,
					Scope:  ScopeAllJobs,
				},
				{
					Action: ActionProvisioningJobsRead,
					Scope:  ScopeAllJobs,
				},
				{
					Action: ActionProvisioningJobsWrite,
					Scope:  ScopeAllJobs,
				},
				{
					Action: ActionProvisioningJobsDelete,
					Scope:  ScopeAllJobs,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	// Historic Jobs
	historicJobsReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.historicjobs:reader",
			DisplayName: "Historic Jobs Reader",
			Description: "Read and list provisioning historic jobs.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningHistoricJobsRead,
					Scope:  ScopeAllHistoricJobs,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return service.DeclareFixedRoles(
		repositoriesReader,
		repositoriesWriter,
		jobsReader,
		jobsWriter,
		historicJobsReader,
	)
}
