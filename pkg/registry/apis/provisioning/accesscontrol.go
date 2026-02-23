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

	// Connections
	ActionProvisioningConnectionsCreate = "provisioning.connections:create" // CREATE.
	ActionProvisioningConnectionsWrite  = "provisioning.connections:write"  // UPDATE.
	ActionProvisioningConnectionsRead   = "provisioning.connections:read"   // GET + LIST.
	ActionProvisioningConnectionsDelete = "provisioning.connections:delete" // DELETE.

	// Jobs
	ActionProvisioningJobsCreate = "provisioning.jobs:create" // CREATE.
	ActionProvisioningJobsWrite  = "provisioning.jobs:write"  // UPDATE.
	ActionProvisioningJobsRead   = "provisioning.jobs:read"   // GET + LIST.
	ActionProvisioningJobsDelete = "provisioning.jobs:delete" // DELETE.

	// Historic Jobs
	ActionProvisioningHistoricJobsRead = "provisioning.historicjobs:read" // GET + LIST.

	// Settings (read-only, needed by multiple UI pages)
	ActionProvisioningSettingsRead = "provisioning.settings:read" // GET + LIST.

	// Stats (read-only, admin-only)
	ActionProvisioningStatsRead = "provisioning.stats:read" // GET + LIST.
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
		Grants: []string{string(org.RoleViewer)},
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

	// Connections
	connectionsReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.connections:reader",
			DisplayName: "Connections Reader",
			Description: "Read and list provisioning connections.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningConnectionsRead,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	connectionsWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.connections:writer",
			DisplayName: "Connections Writer",
			Description: "Create, update and delete provisioning connections.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningConnectionsCreate,
				},
				{
					Action: ActionProvisioningConnectionsRead,
				},
				{
					Action: ActionProvisioningConnectionsWrite,
				},
				{
					Action: ActionProvisioningConnectionsDelete,
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
		Grants: []string{string(org.RoleEditor)},
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
		Grants: []string{string(org.RoleEditor)},
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

	// Settings - granted to Viewer (accessible by all logged-in users)
	settingsReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.settings:reader",
			DisplayName: "Settings Reader",
			Description: "Read provisioning settings.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningSettingsRead,
				},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	// Stats - granted to Admin only
	statsReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:provisioning.stats:reader",
			DisplayName: "Stats Reader",
			Description: "Read provisioning stats.",
			Group:       "Provisioning",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningStatsRead,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return service.DeclareFixedRoles(
		repositoriesReader,
		repositoriesWriter,
		connectionsReader,
		connectionsWriter,
		jobsReader,
		jobsWriter,
		historicJobsReader,
		settingsReader,
		statsReader,
	)
}
