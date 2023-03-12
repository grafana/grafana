---
aliases:
  - ../../../enterprise/access-control/rbac-provisioning/
  - rbac-provisioning/
description: Learn about RBAC Grafana provisioning and view an example YAML provisioning
  file that configures Grafana role assignments.
menuTitle: Provisioning RBAC with Grafana
title: Provisioning RBAC with Grafana
weight: 60
---

# Provisioning RBAC with Grafana

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Advanced]({{< ref "/docs/grafana-cloud" >}}).

You can create, change or remove [Custom roles]({{< relref "./manage-rbac-roles/#create-custom-roles-using-provisioning" >}}) and create or remove [basic role assignments]({{< relref "./assign-rbac-roles/#assign-a-fixed-role-to-a-basic-role-using-provisioning" >}}), by adding one or more YAML configuration files in the `provisioning/access-control/` directory.

Grafana performs provisioning during startup. After you make a change to the configuration file, you can reload it during runtime. You do not need to restart the Grafana server for your changes to take effect.

**Before you begin:**

- Ensure that you have access to files on the server where Grafana is running.

**To manage and assign RBAC roles using provisioning:**

1. Sign in to the Grafana server.

2. Locate the Grafana provisioning folder.

3. Create a new YAML in the following folder: **provisioning/access-control**. For example, `provisioning/access-control/custom-roles.yml`

4. Add RBAC provisioning details to the configuration file. See [manage RBAC roles]({{< relref "../manage-rbac-roles" >}}) and [assign RBAC roles]({{< relref "../assign-rbac-roles" >}}) for instructions, and see this [example role provisioning file]({{< relref "#example" >}}) for a complete example of a provisioning file.

5. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../../developers/http_api/admin/#reload-provisioning-configurations" >}}).

## Example role configuration file using Grafana provisioning

The following example shows a complete YAML configuration file that:

- Create custom roles
- Delete custom roles
- Update basic roles permissions
- Assign roles to teams
- Revoke assignments of roles to teams

## Example

```yaml
---
# config file version
apiVersion: 2

# <list> list of roles to insert/update/delete
roles:
  # <string, required> name of the role you want to create or update. Required.
  - name: 'custom:users:writer'
    # <string> uid of the role. Has to be unique for all orgs.
    uid: customuserswriter1
    # <string> description of the role, informative purpose only.
    description: 'Create, read, write users'
    # <int> version of the role, Grafana will update the role when increased.
    version: 2
    # <int> org id. Defaults to Grafana's default if not specified.
    orgId: 1
    # <list> list of the permissions granted by this role.
    permissions:
      # <string, required> action allowed.
      - action: 'users:read'
        #<string> scope it applies to.
        scope: 'users:*'
      - action: 'users:write'
        scope: 'users:*'
      - action: 'users:create'
  - name: 'custom:global:users:reader'
    # <bool> overwrite org id and creates a global role.
    global: true
    # <string> state of the role. Defaults to 'present'. If 'absent', role will be deleted.
    state: 'absent'
    # <bool> force deletion revoking all grants of the role.
    force: true
  - uid: 'basic_editor'
    version: 2
    global: true
    # <list> list of roles to copy permissions from.
    from:
      - uid: 'basic_editor'
        global: true
      - name: 'fixed:users:writer'
        global: true
    # <list> list of the permissions to add/remove on top of the copied ones.
    permissions:
      - action: 'users:read'
        scope: 'users:*'
      - action: 'users:write'
        scope: 'users:*'
        # <string> state of the permission. Defaults to 'present'. If 'absent', the permission will be removed.
        state: absent

# <list> list role assignments to teams to create or remove.
teams:
  # <string, required> name of the team you want to assign roles to. Required.
  - name: 'Users writers'
    # <int> org id. Will default to Grafana's default if not specified.
    orgId: 1
    # <list> list of roles to assign to the team
    roles:
      # <string> uid of the role you want to assign to the team.
      - uid: 'customuserswriter1'
        # <int> org id. Will default to Grafana's default if not specified.
        orgId: 1
      # <string> name of the role you want to assign to the team.
      - name: 'fixed:users:writer'
        # <bool> overwrite org id to specify the role is global.
        global: true
        # <string> state of the assignment. Defaults to 'present'. If 'absent', the assignment will be revoked.
        state: absent
```

## Useful Links

[Provisioning RBAC setup with Terraform]({{< relref "./rbac-terraform-provisioning">}})

[Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
