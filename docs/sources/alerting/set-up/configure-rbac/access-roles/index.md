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

| Fixed role                                   | Permissions                                                                                                                                                                                                                                                                 | Description                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `fixed:alerting.instances:writer`            | All permissions from `fixed:alerting.instances:reader` and<br> `alert.instances:create`<br>`alert.instances:write` for organization scope <br> `alert.instances.external:write` for scope `datasources:*`                                                                   | Create, update and expire all silences.                                                                                              |
| `fixed:alerting.instances:reader`            | `alert.instances:read` for organization scope <br> `alert.instances.external:read` for scope `datasources:*`                                                                                                                                                                | Read all alerts and silences.                                                                                                        |
| `fixed:alerting.notifications:writer`        | All permissions from `fixed:alerting.notifications:reader` and<br>`alert.notifications:write`for organization scope<br>`alert.notifications.external:read` for scope `datasources:*`                                                                                        | Create, update, and delete contact points, templates, mute timings and notification policies for Grafana and external Alertmanager.  |
| `fixed:alerting.notifications:reader`        | `alert.notifications:read` for organization scope<br>`alert.notifications.external:read` for scope `datasources:*`                                                                                                                                                          | Read all Grafana and Alertmanager contact points, templates, and notification policies.                                              |
| `fixed:alerting.rules:writer`                | All permissions from `fixed:alerting.rules:reader` and <br> `alert.rule:create` <br> `alert.rule:write` <br> `alert.rule:delete` <br> `alert.silences:create` <br> `alert.silences:write` for scope `folders:*` <br> `alert.rules.external:write` for scope `datasources:*` | Create, update, and delete all alert rules and manage rule-specific silences.                                                        |
| `fixed:alerting.rules:reader`                | `alert.rule:read`, `alert.silences:read` for scope `folders:*` <br> `alert.rules.external:read` for scope `datasources:*` <br> `alert.notifications.time-intervals:read` <br> `alert.notifications.receivers:list`                                                          | Read all alert rules and read rule-specific silences.                                                                                |
| `fixed:alerting:writer`                      | All permissions from `fixed:alerting.rules:writer` <br>`fixed:alerting.instances:writer`<br>`fixed:alerting.notifications:writer`                                                                                                                                           | Create, update, and delete all alert rules, silences, contact points, templates, mute timings, and notification policies.            |
| `fixed:alerting:reader`                      | All permissions from `fixed:alerting.rules:reader` <br>`fixed:alerting.instances:reader`<br>`fixed:alerting.notifications:reader`                                                                                                                                           | Read-only permissions for all alert rules, alerts, contact points, and notification policies.                                        |
| `fixed:alerting.provisioning.secrets:reader` | `alert.provisioning:read` and `alert.provisioning.secrets:read`                                                                                                                                                                                                             | Read-only permissions for Provisioning API and let export resources with decrypted secrets.                                          |
| `fixed:alerting.provisioning:writer`         | `alert.provisioning:read` and `alert.provisioning:write`                                                                                                                                                                                                                    | Create, update and delete Grafana alert rules, notification policies, contact points, templates, etc via provisioning API.           |
| `fixed:alerting.provisioning.status:writer`  | `alert.provisioning.provenance:write`                                                                                                                                                                                                                                       | Set provenance status to alert rules, notification policies, contact points, etc. Should be used together with regular writer roles. |

## Create custom roles

Create custom roles of your own to manage permissions. Custom roles contain unique combinations of permissions, actions and scopes. Create a custom role when basic roles and fixed roles do not meet your permissions requirements.

For more information on creating custom roles, refer to [Create custom roles](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/manage-rbac-roles/#create-custom-roles).

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
