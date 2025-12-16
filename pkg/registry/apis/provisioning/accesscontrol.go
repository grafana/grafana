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
				},
				{
					Action: ActionProvisioningRepositoriesRead,
				},
				{
					Action: ActionProvisioningRepositoriesWrite,
				},
				{
					Action: ActionProvisioningRepositoriesDelete,
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
				},
				{
					Action: ActionProvisioningJobsRead,
				},
				{
					Action: ActionProvisioningJobsWrite,
				},
				{
					Action: ActionProvisioningJobsDelete,
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
