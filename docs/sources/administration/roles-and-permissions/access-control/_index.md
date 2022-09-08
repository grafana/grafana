---
aliases:
  - /docs/grafana/latest/enterprise/access-control/
  - /docs/grafana/latest/enterprise/access-control/
  - /docs/grafana/latest/enterprise/access-control/about-rbac/
  - /docs/grafana/latest/enterprise/access-control/roles/
  - /docs/grafana/latest/administration/roles-and-permissions/access-control/
description: Role-based access control (RBAC) provides a standardized way of granting,
  changing, and revoking access so that users can view and modify Grafana resources,
  such as users and reports.
menuTitle: Role-based access control (RBAC)
title: Grafana Role-based access control (RBAC)
weight: 120
---

# Role-based access control (RBAC)

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Advanced]({{< ref "/docs/grafana-cloud" >}}).

RBAC provides a standardized way of granting, changing, and revoking access when it comes to viewing and modifying Grafana resources, such as dashboards, reports, and administrative settings.

{{< section >}}

## About RBAC

Role-based access control (RBAC) provides a standardized way of granting, changing, and revoking access so that users can view and modify Grafana resources, such as users and reports.
RBAC extends Grafana basic roles that are included in Grafana OSS, and enables you more granular control of users’ actions.

By using RBAC you can provide users with permissions that extend the permissions available with basic roles. For example, you can use RBAC to:

- Modify existing basic roles: for example, enable an editor to create reports
- Assign fixed roles to users and teams: for example, grant an engineering team the ability to create data sources
- Create custom roles: for example, a role that allows users to create and edit dashboards, but not delete them

RBAC roles contain multiple permissions, each of which has an action and a scope:

- **Role:** `fixed:datasources:reader`
  - **Permission:**
    - **Action:** `datasources:read`
    - **Scope:** `datasources:*`

### Basic roles

Basic roles are the standard roles that are available in Grafana OSS. If you have purchased a Grafana Enterprise license, you can still use basic roles.

Grafana includes the following basic roles:

- Grafana administrator
- Organization administrator
- Editor
- Viewer

Each basic role is comprised of a number of _permissions_. For example, the viewer basic role contains the following permissions among others:

- `Action: datasources.id:read, Scope: datasources:*`: Enables the viewer to see the ID of a data source.
- `Action: orgs:read`: Enables the viewer to see their organization details
- `Action: annotations:read, Scope: annotations:*`: Enables the viewer to see annotations that other users have added to a dashboard.
- `Action: annotations:create, Scope: annotations:type:dashboard`: Enables the viewer to add annotations to a dashboard.
- `Action: annotations:write, Scope: annotations:type:dashboard`: Enables the viewer to modify annotations of a dashboard.
- `Action: annotations:delete, Scope: annotations:type:dashboard`: Enables the viewer to remove annotations from a dashboard.

> **Note:** You can't have a Grafana user without a basic role assigned.

#### Basic role modification

You can use RBAC to modify the permissions associated with any basic role, which changes what viewers, editors, or admins can do. You can't delete basic roles.

Note that any modification to any of these basic role is not propagated to the other basic roles.
For example, if you modify Viewer basic role and grant additional permission, Editors or Admins won't have that additional grant.

For more information about the permissions associated with each basic role, refer to [Basic role definitions]({{< relref "./rbac-fixed-basic-role-definitions/#basic-role-assignments" >}}).
To interact with the API and view or modify basic roles permissions, refer to [the table]({{< relref "./manage-rbac-roles/#basic-role-uid-mapping" >}}) that maps basic role names to the associated UID.

### Fixed roles

Grafana Enterprise includes the ability for you to assign discrete fixed roles to users, teams, and service accounts. This gives you fine-grained control over user permissions than you would have with basic roles alone. These roles are called "fixed" because you cannot change or delete fixed roles. You can also create _custom_ roles of your own; see more information in the [custom roles section]({{< relref "#custom-roles" >}}) below.

Assign fixed roles when the basic roles do not meet your permission requirements. For example, you might want a user with the basic viewer role to also edit dashboards. Or, you might want anyone with the editor role to also add and manage users. Fixed roles provide users more granular access to create, view, and update the following Grafana resources:

- [Alerting]({{< relref "../../../alerting/" >}})
- [Annotations]({{< relref "../../../dashboards/annotations/" >}})
- [API keys]({{< relref "../../api-keys/" >}})
- [Dashboards and folders]({{< relref "../../../dashboards/" >}})
- [Data sources]({{< relref "../../../datasources/" >}})
- [Explore]({{< relref "../../../explore/" >}})
- [Folders]({{< relref "../../../dashboards/manage-dashboards/#create-a-dashboard-folder" >}})
- [LDAP]({{< relref "../../../setup-grafana/configure-security/configure-authentication/ldap/" >}})
- [Licenses]({{< relref "../../stats-and-license/" >}})
- [Organizations]({{< relref "../../organization-management/" >}})
- [Provisioning]({{< relref "../../provisioning/" >}})
- [Reports]({{< relref "../../../panels/create-reports/" >}})
- [Roles]({{< relref "../../" >}})
- [Settings]({{< relref "../../../enterprise/settings-updates/" >}})
- [Service accounts]({{< relref "../../service-accounts/" >}})
- [Teams]({{< relref "../../team-management/" >}})
- [Users]({{< relref "../../user-management/" >}})

To learn more about the permissions you can grant for each resource, refer to [RBAC role definitions]({{< relref "./rbac-fixed-basic-role-definitions/" >}}).

### Custom roles

If you are a Grafana Enterprise customer, you can create custom roles to manage user permissions in a way that meets your security requirements.

Custom roles contain unique combinations of permissions _actions_ and _scopes_. An action defines the action a use can perform on a Grafana resource. For example, the `teams.roles:read` action allows a user to see a list of roles associated with each team.

A scope describes where an action can be performed. For example, the `teams:id:1` scope restricts the user's action to the team with ID `1`. When paired with the `teams.roles:read` action, this permission prohibits the user from viewing the roles for teams other than team `1`.

Consider creating a custom role when fixed roles do not meet your permissions requirements.

#### Custom role creation

You can use either of the following methods to create, assign, and manage custom roles:

- Grafana provisioning: You can use a YAML file to configure roles. For more information about using provisioning to create custom roles, refer to [Manage RBAC roles]({{< relref "./manage-rbac-roles/" >}}). For more information about using provisioning to assign RBAC roles to users or teams, refer to [Assign RBAC roles]({{< relref "./assign-rbac-roles/" >}}).
- RBAC API: As an alternative, you can use the Grafana HTTP API to create and manage roles. For more information about the HTTP API, refer to [RBAC API]({{< relref "../../../developers/http_api/access_control/" >}}).

### Limitation

If you have created a folder with the name `General` or `general`, you cannot manage its permissions with RBAC.

If you set [folder permissions]({{< relref "../../user-management/manage-dashboard-permissions/#grant-dashboard-folder-permissions" >}}) for a folder named `General` or `general`, the system disregards the folder when RBAC is enabled.
