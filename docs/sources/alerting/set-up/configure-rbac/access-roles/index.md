---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-rbac/access-roles
description: Manage access using roles
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - RBAC
  - role access
labels:
  products:
    - enterprise
    - cloud
title: Manage access using roles
weight: 100
---

# Manage access using roles

In Grafana Enterprise and Grafana Cloud, there are Basic, Fixed, and Custom roles.

## Basic roles

There are four basic roles: Admin, Editor, Viewer, and No basic role. Each basic role contains a number of fixed roles.

The No basic role allows you to further customize access by assigning fixed roles to users, which you can also modify. You can also create and assign custom roles to a user with No basic role.

Details of the basic roles and the access they provide for Grafana Alerting are below.

| Role          | Access                                                                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin         | Write access to alert rules, notification resources (notification API, contact points, templates, time intervals, notification policies, and silences), and provisioning.                                                                           |
| Editor        | Write access to alert rules, notification resources (notification API, contact points, templates, time intervals, notification policies, and silences), and provisioning.                                                                           |
| Viewer        | Read access to alert rules, notification resources (notification API, contact points, templates, time intervals, notification policies, and silences).                                                                                              |
| No basic role | A blank canvas to assign fixed or custom roles and craft permissions more precisely. For example, if you want to give a user the ability to see alert rules, but not notification settings, add No basic role and then the fixed role Rules reader. |

## Fixed roles

A fixed role is a group of multiple permissions.

Fixed roles provide users more granular access to create, view, and update Alerting resources than you would have with basic roles alone.

Details of the fixed roles and the access they provide for Grafana Alerting are below.

| Display name in UI / Fixed role                                                          | Permissions                                                                                                                                                                                                                                                                                                                                     | Description                                                                                                                                              |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Silences Writer: `fixed:alerting.instances:writer`                                       | All permissions from `fixed:alerting.instances:reader` and<br> `alert.instances:create`<br>`alert.instances:write` for organization scope <br> `alert.instances.external:write` for scope `datasources:*`                                                                                                                                       | Add and update silences in Grafana and external providers.                                                                                               |
| Instances and Silences Reader: `fixed:alerting.instances:reader`                         | `alert.instances:read` for organization scope <br> `alert.instances.external:read` for scope `datasources:*`                                                                                                                                                                                                                                    | Read alert instances and silences in Grafana and external providers.                                                                                     |
| Notifications Writer: `fixed:alerting.notifications:writer`                              | All permissions from `fixed:alerting.routes:writer`,<br> `fixed:alerting.receivers:creator`,<br> `fixed:alerting.receivers:writer`,<br> `fixed:alerting.templates:writer`,<br> `fixed:alerting.time-intervals:writer`and<br> `alert.notifications:write`for organization scope<br>`alert.notifications.external:read` for scope `datasources:*` | Add, update, and delete notification policies and contact points in Grafana and external providers.                                                      |
| Notifications Reader: `fixed:alerting.notifications:reader`                              | All permissions from `fixed:alerting.routes:reader`,<br> `fixed:alerting.receivers:reader`,<br> `fixed:alerting.templates:reader`,<br> `fixed:alerting.time-intervals:reader`and<br> `alert.notifications:read` for organization scope<br>`alert.notifications.external:read` for scope `datasources:*`                                         | Read notification policies and contact points in Grafana and external providers.                                                                         |
| Rules Writer: `fixed:alerting.rules:writer`                                              | All permissions from `fixed:alerting.rules:reader` and <br> `alert.rule:create` <br> `alert.rule:write` <br> `alert.rule:delete` <br> `alert.silences:create` <br> `alert.silences:write` for scope `folders:*` <br> `alert.rules.external:write` for scope `datasources:*`                                                                     | Create, update, and delete all alert rules and manage rule-specific silences.                                                                            |
| Rules Reader: `fixed:alerting.rules:reader`                                              | `alert.rule:read`, `alert.silences:read` for scope `folders:*` <br> `alert.rules.external:read` for scope `datasources:*` <br> `alert.notifications.time-intervals:read` <br> `alert.notifications.receivers:list`                                                                                                                              | Read all alert rules and rule-specific silences in Grafana and external providers.                                                                       |
| Full access: `fixed:alerting:writer`                                                     | All permissions from `fixed:alerting.rules:writer` <br>`fixed:alerting.instances:writer`<br>`fixed:alerting.notifications:writer`                                                                                                                                                                                                               | Add, update, and delete alert rules, silences, contact points, and notification policies in Grafana and external providers.                              |
| Full read-only access: `fixed:alerting:reader`                                           | All permissions from `fixed:alerting.rules:reader` <br>`fixed:alerting.instances:reader`<br>`fixed:alerting.notifications:reader`                                                                                                                                                                                                               | Read alert rules, alert instances, silences, contact points, and notification policies in Grafana and external providers.                                |
| Read via Provisioning API + Export Secrets: `fixed:alerting.provisioning.secrets:reader` | `alert.provisioning:read` and `alert.provisioning.secrets:read`                                                                                                                                                                                                                                                                                 | Read alert rules, alert instances, silences, contact points, and notification policies using the provisioning API and use export with decrypted secrets. |
| Access to alert rules provisioning API: `fixed:alerting.provisioning:writer`             | `alert.provisioning:read` and `alert.provisioning:write`                                                                                                                                                                                                                                                                                        | Manage all alert rules, notification policies, contact points, templates, in the organization using the provisioning API.                                |
| Set provisioning status: `fixed:alerting.provisioning.status:writer`                     | `alert.provisioning.provenance:write`                                                                                                                                                                                                                                                                                                           | Set provisioning rules for Alerting resources. Should be used together with other regular roles (Notifications Writer and/or Rules Writer.)              |
| Contact Point Reader: `fixed:alerting.receivers:reader`                                  | `alert.notifications.receivers:read` for scope `receivers:*`                                                                                                                                                                                                                                                                                    | Read all contact points.                                                                                                                                 |
| Contact Point Creator: `fixed:alerting.receivers:creator`                                | `alert.notifications.receivers:create`                                                                                                                                                                                                                                                                                                          | Create a new contact point. The user is automatically granted full access to the created contact point.                                                  |
| Contact Point Writer: `fixed:alerting.receivers:writer`                                  | `alert.notifications.receivers:read`, `alert.notifications.receivers:write`, `alert.notifications.receivers:delete` for scope `receivers:*` and <br> `alert.notifications.receivers:create`                                                                                                                                                     | Create a new contact point and manage all existing contact points.                                                                                       |
| Templates Reader: `fixed:alerting.templates:reader`                                      | `alert.notifications.templates:read`                                                                                                                                                                                                                                                                                                            | Read all notification templates.                                                                                                                         |
| Templates Writer: `fixed:alerting.templates:writer`                                      | `alert.notifications.templates:read`, `alert.notifications.templates:write`, `alert.notifications.templates:delete`                                                                                                                                                                                                                             | Create new and manage existing notification templates.                                                                                                   |
| Time Intervals Reader: `fixed:alerting.time-intervals:reader`                            | `alert.notifications.time-intervals:read`                                                                                                                                                                                                                                                                                                       | Read all time intervals.                                                                                                                                 |
| Time Intervals Writer: `fixed:alerting.time-intervals:writer`                            | `alert.notifications.time-intervals:read`, `alert.notifications.time-intervals:write`, `alert.notifications.time-intervals:delete`                                                                                                                                                                                                              | Create new and manage existing time intervals.                                                                                                           |
| Notification Policies Reader: `fixed:alerting.routes:reader`                             | `alert.notifications.routes:read`                                                                                                                                                                                                                                                                                                               | Read all time intervals.                                                                                                                                 |
| Notification Policies Writer: `fixed:alerting.routes:writer`                             | `alert.notifications.routes:read` `alert.notifications.routes:write`                                                                                                                                                                                                                                                                            | Create new and manage existing time intervals.                                                                                                           |

## Create custom roles

Create custom roles of your own to manage permissions. Custom roles contain unique combinations of permissions, actions and scopes. Create a custom role when basic roles and fixed roles do not meet your permissions requirements.

For more information on creating custom roles, refer to [Create custom roles](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/manage-rbac-roles/#create-custom-roles).

{{< admonition type="note" >}}
It is not recommended to create custom roles that include `alerting.notifications.receiver` actions with a scope other than `receivers:*`. The UID used in the scope is not stable and changes whenever a contact point is renamed.  
{{< /admonition >}}

### Examples

The following examples give you an idea of how you can combine permissions for Grafana Alerting.

A custom role for read access to alert rules in folder F:

<!-- prettier-ignore-start -->
```
PUT access-control/roles
{
	"name": "custom:alert_rules_reader",
	"displayName": "Alert rule reader in folder F",
	"description": "Read access to rules in folder F that use DS1 and DS2",
	"permissions": [
    	{
        	"action": "alert.rules:read",
        	"scope": "folders:uid:UID_F"
    	},
    	{
        	"action": "folders:read",
        	"scope": "folders:uid:UID_F"
    	}
	]
}
```
<!-- prettier-ignore-end -->

A custom role for write access to alert rules that uses simplified routing:

<!-- prettier-ignore-start -->
```
PUT access-control/roles
{
	"name": "custom:alert_rules_updater",
	"displayName": "Alert rules editor in folder F",
	"description": "Edit access to rules in folder F that use DS1 and DS2",
	"permissions": [
    	{
        	"action": "alert.rules:read",
        	"scope": "folders:uid:UID_F"
    	},
    	{
        	"action": "alert.rules:read",
        	"scope": "folders:uid:UID_F"
    	},
    	{
        	"action": "alert.rules:write",
        	"scope": "folders:uid:UID_F"
    	},
    	{
        	"action": "alert.rules:create",
        	"scope": "folders:uid:UID_F"
    	},
    	{
        	"action": "alert.notifications.receivers:list",
    	},
{
        	"action": "alert.notifications.time-intervals:read",
    	},
	]
}
```
<!-- prettier-ignore-end -->

{{< admonition type="note" >}}
Delete the last two permissions if you aren’t using simplified notification routing.
{{< /admonition >}}

## Assign roles

To assign roles, complete the following steps.

1. Navigate to Administration > Users and access > Users, Teams, or Service Accounts.
1. Search for the user, team or service account you want to add a role for.
1. Select the role you want to assign.
