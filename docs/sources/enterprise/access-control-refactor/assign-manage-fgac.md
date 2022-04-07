---
title: 'Assign and manage fine-grained acces control permissions'
menuTitle: 'Assign and manage fine-grained acces control permissions'
description: 'xxx.'
aliases: [xxx]
weight: 40
keywords:
  - xxx
---

# Assign and manage fine-grained access control permissions

This topic describes how to:

- Assign a fine-grained access control role to a user within the context of an organization
- Assign a fine-grained access control role to a user to multiple organizations, within the context of a server administration.

In both cases, the assignment applies only to the user role within the affected organization, and no other organizations. For example, if you grant the user the **Data source editor** role in the **Main** organization, then the user can edit data sources in the **Main** organization, but not in other organizations.

> **Note:** After you apply your changes, the user's permissions update immediately, and the UI reflects their new permissions the next time they reload their browser or visit another page.

### Before you begin

- [Plan your fine-grained rollout strategy](./plan-fgac-rollout-strategy.md).
- Identify the fine-grained access control role that you want to assign to the user.

  For more information about available fine-grained access control roles, refer to [LINK]

- Ensure that your Grafana user is assigned one of the following roles:
  - The admininstrator built-in role.
  - The Grafana server administrator role.
  - The `fixed:roles:writer` fixed role that is assigned to the same organization to which you are assigning a user's fine-grained access control.
  - A custom role with `users.roles:add` and `users.roles:remove` permissions.
- Ensure that you have the permissions granted by the roles that you want to assign or revoke.

**To assign a fine-grained access control role to a user within the context of an organization**

1. Sign in to Grafana.
1. Switch to the organization of which the user is a member.

   For more information about switching organizations, refer to [Switch organizations](../../../administration/manage-user-preferences/_index.md#switch-organizations).

1. Hover your cursor over **Configuration** (the gear icon) in the left navigation menu, and click **Users**.
1. Click the **Role** associated with the user.
1. Select the role that you want to assign to the user.
1. Click **Update**.

![User role picker in an organization](/static/img/docs/enterprise/user_role_picker_global.png)

<br/>

**To assign a fine-grained access control role within the context of a server administrator**

1. Sign in to Grafana, hover your cursor over **Server Admin** (the shield icon) in the left navigation menu, and click **Users**.
1. Click a user.
1. In the **Organizations** section, select a role within an organization that you want to assign to the user.
1. Click **Update**.
1. If required, continue assigning roles to the user in other organizations.

![User role picker in Organization](/static/img/docs/enterprise/user_role_picker_in_org.png)
