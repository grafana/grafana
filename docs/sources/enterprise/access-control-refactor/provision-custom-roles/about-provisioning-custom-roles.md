---
title: 'About creating or updating custom roles using Grafana provisioning'
menuTitle: 'About provisioning custom roles'
description: 'xxx.'
aliases: [xxx]
weight: 10
keywords:
  - xxx
---

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
