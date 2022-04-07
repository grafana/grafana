---
title: 'About fine-grained access control'
menuTitle: 'About fine-grained access control'
description: 'xxx.'
aliases: [xxx]
weight: 10
keywords:
  - xxx
---

# About fine-grained access control

Fine-grained access control provides a standardized way of granting, changing, and revoking access so that users can view and modify Grafana resources, such as users and reports.
Fine-grained access control extends Grafana permissions that are included in Grafana OSS, and enables you more granular control of users’ actions.

> **Note:** Fine-grained access control is in beta, so you can expect changes in future releases.

By using fine-grained access control you can provide users with permissions that extend beyond the permissions available with Grafana OSS roles. For example, you can use fine-grained access control to:

- Enable an editor to create reports
- Prevent a Grafana Admin from creating and inviting users to an organization
- Enable a viewer to create users

## Built-in roles

Built-in roles are the standard roles that are available in Grafana OSS. If you have purchased a Grafana Enterprise license, you also receive built-in roles.

Grafana includes the following built-in roles:

- Grafana administrator
- Organization admininstrator
- Editor
- Viewer

Each built-in role is comprised of a number of _fixed roles_ that control the permissions a built-in role has. For example, the Viewer built-in role contains the following fixed roles:

- `fixed:datasources:id:reader`: Enables the viewer to see the ID of a data source.
- `fixed:organization:reader`: Enables the viewer to see a list of organizations.
- `fixed:annotations:reader`: Enables the viewer to see annotations that other users have added to a dashboard.
- `fixed:annotations.dashboard:writer`: Enables the viewer to add annotations to a dashboard.

For more information about the fixed role associated with each built-in role, refer to [Built-in role definitions]({{< relref "./built-in-role-definitions.md" >}}).

> **Note:** You must assign each Grafana user a built-in role.

## Fixed roles

Grafana Enterprise includes the ability for you to assign discrete fixed roles to users and teams, which enables you fine-grained control over user permissions. Grafana Labs manages fixed role definitions.

Assign fixed roles when the built-in roles do not meet your permission requirements. For example, you might want the built-in viewer role to also edit dashboards. Or you might want the editor role to also create and manage users. To meet your needs, you can use fixed roles to extend built-in roles and provide users more granular access to create, view, and update Grafana resources.

### Resources with fine-grained permissions

Fine-grained access control is available for the following capabilities:

- [Annotations]({{< relref "../../dashboards/annotations.md" >}}) 
- API keys
- [Dashboards]({{< relref "../../dashboards/_index.md" >}})
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
- Statistics
- [Teams]({{< relref "../../administration/manage-users-permissions/manage-teams/_index.md" >}})
- [Users]({{< relref "../../administration/manage-users-and-permissions/manage-server-users/_index.md" >}})

To learn more about the permissions associated with each fixed role, refer to [Fine-grained access control fixed role definitions]({{< relref "./fgac-fixed-role-definitions.md" >}}).

### Fixed role constraints

Consider the following constraints when you assign fixed roles to users or teams:

- All fixed roles are _global_, which means that role assignments work across organizations.
- You cannot change or delete a fixed role.
- All fixed roles begin with the prefix `fixed:`.


## Custom roles

If you are a Grafana Enterprise customer, you also have the ability to create custom roles. Custom roles contain unique combinations of permissions _actions_ and _scopes_. An action defines the action a use can perform on a Grafana resource. For example, the `teams.roles:list` action means that the use can see a list of role associated with each team.

A scope describes where an action can be performed. For example, the `teams*:` scope restricts the user's action to teams. When paired with the `teams.roles:list` action, this permission prohibits the user from viewing roles associated with any other Grafana resource, for example, organizations.






# Roles

A role represents set of permissions that allow you to perform specific actions on Grafana resources. Refer to [About users and permissions]({{< relref "../../administration/manage-users-and-permissions/about-users-and-permissions.md" >}}) to understand how permissions work.

There are two types of roles:

- [Fixed roles]({{< relref "./roles.md#fixed-roles" >}}), which provide granular access for specific resources within Grafana and are managed by the Grafana itself.
- [Custom roles]({{< relref "./roles.md#custom-roles.md" >}}), which provide granular access based on the user specified set of permissions.

You can use [Fine-grained access control API]({{< relref "../../http_api/access_control.md" >}}) to list available roles and permissions.


## Custom roles

Custom roles allow you to manage access to your users the way you want, by mapping [fine-grained permissions]({{< relref "./permissions.md" >}}) to it and creating [built-in role assignments]({{< ref "#built-in-role-assignments.md" >}}).

To create, update or delete a custom role, you can use the [Fine-grained access control API]({{< relref "../../http_api/access_control.md" >}}) or [Grafana Provisioning]({{< relref "./provisioning.md" >}}).

## Assign roles

[Custom roles]({{< ref "#custom-roles" >}}) and [Fixed roles]({{< ref "#fixed-roles" >}}) can be assigned to users, the existing [Organization roles]({{< relref "../../administration/manage-users-and-permissions/about-users-and-permissions.md#organization-users-and-permissions" >}}) and to the [Grafana Server Admin]({{< relref "../../administration/manage-users-and-permissions/about-users-and-permissions.md#grafana-server-administrators" >}}) role.

Visit [Manage role assignments]({{< relref "manage-role-assignments/_index.md" >}}) page for more details.

### Scope of assignments

A role assignment can be either _global_ or _organization local_. _Global_ assignments are not mapped to any specific organization and will be applied to all organizations, whereas _organization local_ assignments are only applied for that specific organization.
You can only create _organization local_ assignments for _organization local_ roles.
