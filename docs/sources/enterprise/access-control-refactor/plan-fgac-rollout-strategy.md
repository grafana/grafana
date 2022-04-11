---
title: 'Plan your Grafana role-based access control rollout strategy'
menuTitle: 'Plan your RBAC rollout strategy'
description: 'xxx.'
aliases: [xxx]
weight: 20
keywords:
  - xxx
---

# Plan your role-based access control rollout strategy

An RBAC rollout strategy includes the planning you undertake and the decisions you make prior to assign RBAC roles to user, teams, and folders.

Your rollout strategy should help you answer the following questions:

- Should I assign default roles to users, or should I assign fixed roles or custom roles to users?
- When should I create custom roles?
- To what entities should I apply fixed and custom roles? Should I apply them to users, teams, or to built-in roles?
- How do I roll out permissions in a way that makes them easy to manage?
- What options do I have when assigning roles?

## Review built-in role and fixed role definitions

As a first step in determining your permissions rollout strategy, we recommend that you become familiar with built-in role and fixed role defintions. In addition to assigning fixed roles to any user and team, you can also assign fixed roles to built-in roles and custom roles. This flexibilty means that there are many combinations of fixed role assignments for you to consider. If you have a large number of Grafana users and teams, we recommend that you make a list of which fixed roles you might want to use.

To learn more about built-in roles and fixed role, refer to the following documentation:

- [Built-in role definitions](LINK)
- [Fixed role definitions](LINK)

## User and team considerations

RBAC is a flexible and powerful feature with many possible permissions assignment combinations available. Consider the follow guidelines when assigning permissions to users and teams.

- **Assign roles to users** when you have a one-off scenario where a user requires access to a resource or when you want to assign temporary access. If you have a large number of users, this approach can be difficult to manage as you scale your use of Grafana.

- **Assign roles to teams** when you have a subset of users that align to your organizational structure, and you want all members of the team to have the same level of access.

  When you assign permissions to teams, all members of the team have the same level of access. When you assign additional users to a team, the system automatically assigns permissions to those users.

### Authentication provider considerations

You can take advantage of your current authentication provider to manage user and team permissions in Grafana. When you map users and teams to SAML and LDAP groups, you can synchronize those assignments with Grafana.

For example:

1. Within SAML or LDAP assign users to roles (viewer, editor, or admin) or teams.
1. Use Grafana Enterprise team sync feature to synchronize from your authentication provider to Grafana.

   - If a team does not exist in Grafana, team sync creates it.
   - If a team exists in Grafana, team sync updates it.

   For more information about team sync, refer to [Team sync]({{< relref "../team-sync.md" >}}).

1. In Grafana, assign RBAC permissions to roles and teams.

## When to modify built-in roles or create custom roles

Consider the following guidelines when you determine if you should modify built-in roles or create custom roles.

- **Modify built-in roles** when Grafana's definitions of what viewers, editors, and admins can do does not match your definition of these roles. You can add or remove fixed roles from any built-in role.

  > **Note:** Changes that you make to built-in roles are _global_ and impact the role definition across the Grafana instance. For example, when you assign the `fixed:users:writer` role to the viewer built-in role, all viewers in the Grafana instance can create users.

- **Create custom roles** when you don't want to modify built-in roles, and when fixed role definitions don't meet you permissions requirements.

## How to assign RBAC roles

Use any of the following methods when you assign RBAC roles to users and teams.

- **Grafana UI:** Use the Grafana UI when you want to assign a limited number of RBAC roles to users and teams. The UI contains a role picker that you can use to select roles.
- **Grafana HTTP API:** If you prefer, you can use the Grafana HTTP API to manage role assignments.
- **Grafana provisioning:** Grafana provisioning provides a robust approach to assign, removing, and deleting roles. Within a single YAML file you can include multiple role assignment and removal entries.
- **Terraform:** If you are a Grafana Cloud Pro customer, you can use Terraform to assign and manage user and team role assignments.

## Permissions scenarios

We've compiled the following permissions rollout scenarios based on current Grafana requirements. If you have a use case that you'd like to share, feel free to contribute to the content. We'd love to hear from you!

### Provide internal viewer employees with the ability to use Explore and prevent external viewer contractors from using Explore

1. In Grafana, create a team with the name `Internal employees`.
1. Assign the `fixed:datasources:querier`role to the `Internal employees` team.
1. Assign internal employees to the `Internal employees` team.
1. Assign the viewer role to both internal employees and contractors

### Limit viewer, editor, or admin permissions

1. Review the list of fixed roles associated with the built-in role.
1. Remove the fixed roles from the built-in role.

### Limit users (regardless of their built-in role) ability to access the Alert Manager, while providing that ability to other users

1. Remove the following fixed roles from all built-in roles:
   - fixed:alerts:reader
   - fixed:alerts:writer
1. Create an `Alert Managers` team, and assign the following fixed roles:
   - fixed:alerts:reader
   - fixed:alerts:writer
1. Assign users to the `Alert Managers` team.

### Provide dashboards to users in two or more geographies

1. Create a folder for each geography, for example, create a `US` folder and an `EU` folder.
1. Add dashboards to each folder.
1. Assign US users to the `US` dashboard and assign EU users to the `EU` folder.
