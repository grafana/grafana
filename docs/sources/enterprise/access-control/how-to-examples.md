+++
title = "How-to examples"
description = "How-to examples of using fine-grained access control"
keywords = ["grafana", "fine-grained-access-control", "roles", "permissions", "how-to", "enterprise"]
weight = 130
+++

# How-to examples

This guide contains several examples of using fine-grained roles and permissions for controlling access to Grafana resources.

## Prevent Grafana Admin from creating users

In order to create users, you would need to have `users:create` permission. By default, user with Grafana Admin role can create users as there is a [built-in role assignment]({{< relref "./concepts/roles#built-in-role-assignments" >}}) which comes with `users:create` permission.

If you want to prevent Grafana Admin from creating users, you do the following:

1. [List all built-in roles]({{< relref "../../http_api/access_control.md" >}}) to see what built-in role assignments are there.  
1. From built-in role assignments, fine the role which gives `users:create` permission. Refer to [predefined roles]({{< relref "./concepts/roles.md" >}}) for full list of permission assignments. 
1. Remove the built-in role assignment by using an [Access Control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or by [provisioning]({{< relref "./provisioning" >}}).
