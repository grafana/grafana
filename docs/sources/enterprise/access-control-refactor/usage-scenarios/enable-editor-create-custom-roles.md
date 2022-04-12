---
title: 'Enable an editor to create custom roles'
menuTitle: 'Enable an editor to create custom roles'
description: 'xxx.'
aliases: [xxx]
weight: 20
keywords:
  - xxx
---

# Enable an editor to create custom roles

By default, the Grafana Server Admin is the only user who can create and manage custom roles. If you want your users to do the same, you have two options:

1. Create a basic role assignment and map `fixed:permissions:admin:edit` and `fixed:permissions:admin:read` fixed roles to the `Editor` basic role.
1. [Create a custom role]({{< ref "#create-your-custom-role" >}}) with `roles.builtin:add` and `roles:write` permissions, then create a basic role assignment for `Editor` organization role.

Note that any user with the ability to modify roles can only create, update or delete roles with permissions they themselves have been granted. For example, a user with the `Editor` role would be able to create and manage roles only with the permissions they have, or with a subset of them.
