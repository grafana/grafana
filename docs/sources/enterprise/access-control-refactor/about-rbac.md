---
title: 'About role-based access control'
menuTitle: 'About role-based access control'
description: 'xxx.'
aliases: [xxx]
weight: 10
keywords:
  - xxx
---

# About role-based access control

Role-based access control (RBAC) provides a standardized way of granting, changing, and revoking access so that users can view and modify Grafana resources, such as users and reports.
RBAC extends Grafana basic roles that are included in Grafana OSS, and enables you more granular control of users’ actions.

> **Note:** RBAC is in beta, so you can expect changes in future releases.

By using RBAC you can provide users with permissions that extend the permissions available with basic roles. For example, you can use RBAC to:

- Modify existing basic roles, for example, enable an editor to create reports
- Assign fixed roles to users and teams
- Create custom roles

## Basic roles

Basic roles are the standard roles that are available in Grafana OSS. If you have purchased a Grafana Enterprise license, you also receive basic roles.

Grafana includes the following basic roles:

- Grafana administrator
- Organization administrator
- Editor
- Viewer

Each basic role is comprised of a number of _fixed roles_ that control the permissions a basic role has. For example, the Viewer basic role contains the following fixed roles:

- `fixed:datasources:id:reader`: Enables the viewer to see the ID of a data source.
- `fixed:organization:reader`: Enables the viewer to see a list of organizations.
- `fixed:annotations:reader`: Enables the viewer to see annotations that other users have added to a dashboard.
- `fixed:annotations.dashboard:writer`: Enables the viewer to add annotations to a dashboard.

You can use RBAC to modify the fixed roles associated with any basic role. For more information about the fixed roles associated with each basic role, refer to [Basic role definitions]({{< relref "./basic-role-definitions.md" >}}).

> **Note:** You must assign each Grafana user a basic role.

## Fixed roles

Grafana Enterprise includes the ability for you to assign discrete fixed roles to users and teams, which enables you fine-grained control over user permissions. Grafana Labs manages fixed role definitions.

Assign fixed roles when the basic roles do not meet your permission requirements. For example, you might want the basic viewer role to also edit dashboards. Or you might want the editor role to also create and manage users. To meet your needs, you can use fixed roles to extend basic roles and provide users more granular access to create, view, and update Grafana resources.

### Resources with RBAC permissions

You apply RBAC to the following Grafana resources:

- [Annotations]({{< relref "../../dashboards/annotations.md" >}})
- [API keys]({{< relref "../../administration/api-keys/_index.md" >}})
- [Dashboards and folders]({{< relref "../../dashboards/_index.md" >}})
- [Data sources]({{< relref "../../datasources/_index.md" >}})
- [Explore]({{< relref "../../explore/_index.md" >}})
- [Folders]({{< relref "../../dashboards/dashboard_folders.md" >}})
- [LDAP]({{< relref "../../auth/ldap/_index.md" >}})
- [Licenses]({{< relref "../license/_index.md" >}})
- [Organizations]({{< relref "../../administration/manage-organizations/_index.md" >}})
- [Provisioning]({{< relref "../../administration/provisioning/_index.md" >}})
- [Reports]({{< relref "../reporting.md" >}})
- [Roles]({{< relref "../../administration/manage-users-permissions/_index.md" >}})
- [Settings]({{< relref "../settings-updates.md" >}})
- [Service accounts]({{< relref "../../administration/service-accounts/_index.md" >}})
- [Teams]({{< relref "../../administration/manage-users-permissions/manage-teams/_index.md" >}})
- [Users]({{< relref "../../administration/manage-users-and-permissions/manage-server-users/_index.md" >}})

To learn more about the permissions associated with each fixed role, refer to [Role-based access control fixed role definitions]({{< relref "./rbac-fixed-role-definitions.md" >}}).

To learn how to assign fixed roles to a user or team, refer to [Assign and manage fixed roles]({{< relref "./assign-manage-fixed-roles.md" >}})

### Fixed role constraints

Consider the following constraints when you assign fixed roles to users or teams:

- All fixed roles are _global_, which means that role assignments work across organizations.
- You cannot change or delete a fixed role.
- All fixed roles begin with the prefix `fixed:`.

## Custom roles

If you are a Grafana Enterprise customer, you can create custom roles that help you to manage user permissions in a way that meets your security requirements.

Custom roles contain unique combinations of permissions _actions_ and _scopes_. An action defines the action a use can perform on a Grafana resource. For example, the `teams.roles:list` action means that the use can see a list of role associated with each team.

A scope describes where an action can be performed. For example, the `teams*:` scope restricts the user's action to teams. When paired with the `teams.roles:list` action, this permission prohibits the user from viewing roles associated with any other Grafana resource, for example, organizations.

Consider creating a custom role when you don't want to modify basic roles, and when fixed roles do not meet your permissions requirements.

### Custom role creation

You can use either of the following methods to create and manage custom roles:

- [Create, update, or delete custom roles using Grafana provisioning({{< relref "../provision-custom-roles.md" >}}).
- [Role-based access control API]({{< relref "../../http_api/access_control.md" >}})

# About creating or updating custom roles using provisioning

You can create a custom role when the default roles and fixed roles do not meet your permissions requirements. A custom role enables you to manage user permissions to best suit your needs.

You can use Grafana provisioning to:

- Create, update, and delete a custom role
- Assign a custom role to a team
- Assign a custom role to a default role
- Assign a fixed role to a team

> **Note:** You can also create, update and delete custom roles by using the [Access Control HTTP API]({{< relref "../../../http_api/access_control.md" >}})

## Custom role actions and scopes

Custom roles contain unique combinations of permissions _actions_ and _scopes_. An action defines the action a use can perform on a Grafana resource. For example, the `teams.roles:list` action means that the use can see a list of role associated with each team.

A scope describes where an action can be performed. For example, the `teams*:` scope restricts the user's action to teams. When paired with the `teams.roles:list` action, this permission prohibits the user from viewing roles associated with any other Grafana resource, for example, organizations.

For more information about custom role actions and scopes, refer to [Role-based access control permissions actions and scopes]({{< relref "../custom-role-actions-scopes.md" >}}).

### Custom role assignment

When you create a custom role, the role appears in the UI along with the default RBAC roles. As with default roles, you use the role picker to assign a custom role to a user. For more information about assigning default roles, refer to [Change a user's organization permissions]({{< relref "../../../administration/manage-users-and-permissions/manage-org-users/change-user-org-permissions.md" >}}).

## Global vs local custom roles

A custom role can be either _global_ or _organization local_. Global roles are not associated with any specific organization, which means that you can reuse them across all organizations. Organization local roles are only available for the organization you specify.

## Org IDs

Mitch, there is guidance about what to enter for `OrgId` in the create task, but it feels like the Org concept, and how it applies to custom roles could be expanded in this section? I wonder if there are additional configuration tasks we need to surface for users?

## Hidden roles

What is this and when would a user hide a role?
