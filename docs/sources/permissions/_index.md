+++
title = "Permissions"
description = "Permissions"
keywords = ["grafana", "configuration", "documentation", "admin", "users", "datasources", "permissions"]
type = "docs"
aliases = ["/docs/grafana/latest/permissions/overview/"]
[menu.docs]
name = "Permissions"
identifier = "permissions"
weight = 50
+++

# Permissions

What you can do in Grafana is defined by the _permissions_ associated with your user account.

There are three types of permissions:
- Permissions granted as a Grafana server admin
- Permissions associated with your role in an organization
- Permissions granted to a specific folder or dashboard

## Grafana server admin

Grafana server admins have the **Grafana Admin** flag enabled on their account. They can access the **Server Admin** menu and perform the following tasks:

- Manage users and permissions.
- Create, edit, and delete organizations.
- View server-wide settings that are set in the [Configuration]({{< relref "../administration/configuration.md" >}}) file.
- View Grafana server stats, including total users and active sessions.
- Upgrade the server to Grafana Enterprise.

## Organization roles

Users can belong to one or more organizations. A user's organization membership is tied to a role that defines what the user is allowed to do
in that organization. Grafana supports multiple *organizations* in order to support a wide variety of deployment models, including using a single Grafana instance to provide service to multiple potentially untrusted organizations.

In most cases, Grafana is deployed with a single organization.

Each organization can have one or more data sources.

All dashboards are owned by a particular organization.

 > **Note:** Most metric databases do not provide per-user series authentication. This means that organization data sources and dashboards are available to all users in a particular organization.

Refer to [Organization roles]({{< relref "../permissions/organization_roles.md" >}}) for more information.

## Dashboard and folder permissions

Dashboard and folder permissions allow you to remove the default role based permissions for Editors and Viewers and assign permissions to specific **Users** and **Teams**. Learn more about [Dashboard and Folder Permissions]({{< relref "dashboard_folder_permissions.md" >}}).

## Data source permissions

Per default, a data source in an organization can be queried by any user in that organization. For example a user with `Viewer` role can still
issue any possible query to a data source, not just those queries that exist on dashboards he/she has access to.

Data source permissions allows you to change the default permissions for data sources and restrict query permissions to specific **Users** and **Teams**. Read more about [data source permissions]({{< relref "datasource_permissions.md" >}}).

