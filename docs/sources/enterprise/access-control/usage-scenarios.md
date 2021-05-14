+++
title = "Fine-grained access control usage scenarios"
description = "Fine-grained access control usage scenarios"
keywords = ["grafana", "fine-grained-access-control", "roles", "permissions", "fine-grained-access-control-usage", "enterprise"]
weight = 125
+++

# Fine-grained access control usage scenarios

This guide contains several examples and usage scenarios of using fine-grained roles and permissions for controlling access to Grafana resources.

## Check all built-in role assignments

You can use the [Fine-grained access control HTTP API]({{< relref "../../http_api/access_control.md#get-all-built-in-role-assignments" >}}) to see all available built-in role assignments. 
The response contains a mapping between one of the oganization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin` to the custom or predefined roles. 

To see what permissions each of the assigned roles has, you can a [Get a role]({{< relref "../../http_api/access_control.md#get-a-role" >}}) by using an HTTP API.

## Create your first custom role

You can create your custom role by either using an [HTTP API]({{< relref "../../http_api/access_control.md#create-a-new-custom-role" >}}) or by using [Grafana provisioning]({{< relref "./provisioning.md" >}}).
You can take a look at [actions and scopes]({{< relref "./provisioning.md#action-definitions" >}}) to decide what permissions would you like to map to your role.

Once the custom role is created, you can create a built-in role assignment by using an [HTTP API]({{< relref "../../http_api/access_control.md#create-a-built-in-role-assignment" >}}). 
If you created your role using [Grafana provisioning]({{< relref "./provisioning.md" >}}), you can also create the assignment with it. 

## Prevent Grafana Admin from creating and inviting users

In order to create users, you would need to have `users:create` permission. By default, user with Grafana Admin role can create users as there is a [built-in role assignment]({{< relref "./roles#built-in-role-assignments" >}}) which comes with `users:create` permission.

If you want to prevent Grafana Admin from creating users, you can do the following:

1. [Check all built-in role assignments]({{< ref "#check-all-built-in-role-assignments" >}}) to see what built-in role assignments are available.  
1. From built-in role assignments, find the role which gives `users:create` permission. Refer to [predefined roles]({{< relref "./roles.md#predefined-roles" >}}) for full list of permission assignments. 
1. Remove the built-in role assignment by using an [Fine-grained access control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or by using [Grafana provisioning]({{< relref "./provisioning" >}}).

## Allow Viewers to create reports

In order to create reports, you would need to have `reports.admin:write` permission. By default, Grafana Admin's or organization Admin can create reports as there is a [built-in role assignment]({{< relref "./roles#built-in-role-assignments" >}}) which comes with `reports.admin:write` permission.

If you want your users who have `Viewer` organization role to create reports, you have two options:

1. First option is to create a built-in role assignment and map `grafana:roles:reporting:admin:edit` predefined role to the `Viewer` built-in role. Note that `grafana:roles:reporting:admin:edit` predefined role allows doing more than creating reports. Refer to [predefined roles]({{< relref "./roles.md#predefined-roles" >}}) for full list of permission assignments.
1. Second option is to create a custom role with `reports.admin:write` permission, and create a built-in role assignment for `Viewer` organization role.
