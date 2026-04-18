---
aliases:
  - ../../../enterprise/access-control/manage-rbac-roles/
  - ../../../enterprise/access-control/manage-role-assignments/
  - ../../../enterprise/access-control/provisioning/
description: Learn how to view permissions associated with roles, create custom roles,
  and update and delete roles in Grafana.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Manage RBAC roles
title: Manage Grafana RBAC roles
weight: 70
refs:
  configure-rbac-configure-rbac-in-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/configure-rbac/#configure-rbac-in-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/configure-rbac/#configure-rbac-in-grafana
  api-rbac-reset-basic-roles-to-their-default:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#reset-basic-roles-to-their-default
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#reset-basic-roles-to-their-default
  api-rbac-delete-a-custom-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#delete-a-custom-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#delete-a-custom-role
  api-rbac-update-a-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#update-a-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#update-a-role
  api-rbac-get-a-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#get-a-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#get-a-role
  api-rbac-create-a-new-custom-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#create-a-new-custom-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#create-a-new-custom-role
  plan-rbac-rollout-strategy:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/plan-rbac-rollout-strategy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/plan-rbac-rollout-strategy/
  custom-role-actions-scopes:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/custom-role-actions-scopes/
  rbac-terraform-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-terraform-provisioning/
  rbac-grafana-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-grafana-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-grafana-provisioning/
  rbac-role-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/
  rbac-fixed-basic-role-definitions-basic-role-assignments:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/#basic-role-assignments
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/#basic-role-assignments
---

# Manage RBAC roles

{{< admonition type="note" >}}
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/).
{{< /admonition >}}

This section includes instructions for how to view permissions associated with roles, create custom roles, and update and delete roles.

## View basic role definitions

You can retrieve the full definition of a basic role, including all associated permissions, using the API or by navigating directly to the endpoint URL in your browser while logged in as an Admin.

### Using the API

To get the definition of a basic role:

```bash
GET /api/access-control/roles/basic_<role>
```

Where `<role>` is one of: `viewer`, `editor`, `admin`, or `grafana_admin`.

For example, to get the Viewer role definition:

```bash
curl --location 'https://<your-stack-name>.grafana.net/api/access-control/roles/basic_viewer' \
  --header 'Authorization: Bearer <service-account-token>'
```

### Using the browser

You can also view the role definition directly in your browser by navigating to:

```
https://<your-stack-name>.grafana.net/api/access-control/roles/basic_viewer
```

This works when logged in as an Admin user.

For more information, refer to [Get a role](ref:api-rbac-get-a-role).

For a reference of basic and fixed role assignments, refer to [RBAC role definitions](ref:rbac-role-definitions).

## Update role permissions

If the default basic role permissions don't meet your requirements you can change them.

You can change basic roles' permissions [via the configuration file](#update-basic-role-permissions-in-the-configuration-file) or [using the RBAC API](#update-basic-role-permissions-using-the-rbac-api).

### Update basic role permissions in the configuration file

Before you begin, determine the permissions you want to add or remove from a basic role. For more information about the permissions associated with basic roles, refer to [RBAC role definitions](ref:rbac-fixed-basic-role-definitions-basic-role-assignments).

{{< admonition type="note" >}}
You cannot modify the `None` permissions.
{{< /admonition >}}

To change permissions for a basic role:

1. Open the YAML configuration file and locate the `roles` section.

1. Refer to the following table to add attributes and values.

   | Attribute             | Description                                                                                                                                               |
   | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `name`                | The name of the basic role you want to update. You can specify a `uid` instead of a role name. The role `name` or the `uid` are required.                 |
   | `orgId`               | Identifies the organization to which the role belongs. `global` can be used instead to specify it's a global role.                                        |
   | `version`             | Identifies the version of the role, which prevents overwriting newer changes.                                                                             |
   | `overrideRole`        | If set to true, role will be updated regardless of its version in the database. There is no need to specify `version` if `overrideRole` is set to `true`. |
   | `from`                | List of roles from which to copy permissions.                                                                                                             |
   | `permissions > state` | The state of the permission. You can set it to `absent` to ensure it exclusion from the copy list.                                                        |

1. Reload the provisioning configuration file. For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/admin/#reload-provisioning-configurations).

#### Example: Modify the Grafana Admin role

The following example modifies the `Grafana Admin` basic role permissions.

In the new configuration:

- Permissions to list, grant, and revoke roles to teams are removed.
- Permission to read and write Grafana folders is added.

```yaml
# config file version
apiVersion: 2

roles:
  - name: 'basic:grafana_admin'
    global: true
    version: 3
    from:
      - name: 'basic:grafana_admin'
        global: true
    permissions:
      # Permissions to remove
      - action: 'teams.roles:read'
        scope: 'teams:*'
        state: 'absent'
      - action: 'teams.roles:remove'
        scope: 'permissions:type:delegate'
        state: 'absent'
      - action: 'teams.roles:add'
        scope: 'permissions:type:delegate'
        state: 'absent'
      # Permissions to add
      - action: 'folders:read'
        scope: 'folder:*'
      - action: 'folders:write'
        scope: 'folder:*'
```

{{< admonition type="note" >}}
You can add multiple `fixed`, `basic` or `custom` roles to the `from` section. Their permissions will be copied and added to the basic role.
Make sure to **increment** the role version for the changes to be accounted for.
{{< /admonition >}}

### Update basic role permissions using the RBAC API

Refer to the [RBAC HTTP API](ref:api-rbac-update-a-role) for more details.

## Reset basic roles to their default

You have two options to reset the basic roles permissions to their default.

### Use the configuration option

> **Note**: Available as of Grafana Enterprise 9.4.

> Warning: If this option is left to true, permissions will be reset on every boot.

Use the [`reset_basic_roles`](ref:configure-rbac-configure-rbac-in-grafana) option to reset basic roles permissions to their default on Grafana instance boot up.

1. Open you configuration file and update the rbac section as follow:

```bash
[rbac]
reset_basic_roles = true
```

### Use the HTTP endpoint

An alternative to the configuration option is to use the HTTP endpoint.

1. Open the YAML configuration file and locate the `roles` section.

1. Grant the `action: "roles:write", scope: "permissions:type:escalate` permission to `Grafana Admin`. Note that this permission has not been granted to any basic roles by default, because users could acquire more permissions than they previously had through the basic role permissions reset.

   ```yaml
   apiVersion: 2
   roles:
     - name: 'basic:grafana_admin'
       global: true
       version: 3
       from:
         - name: 'basic:grafana_admin'
           global: true
       permissions:
         # Permission allowing to reset basic roles
         - action: 'roles:write'
           scope: 'permissions:type:escalate'
   ```

1. As a `Grafana Admin`, call the API endpoint to reset the basic roles to their default. Refer to the [RBAC HTTP API](ref:api-rbac-reset-basic-roles-to-their-default) for more details.
