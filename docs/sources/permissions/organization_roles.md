+++
title = "Organization roles"
description = "Grafana organization roles guide "
keywords = ["grafana", "configuration", "documentation", "organization", "roles", "permissions"]
type = "docs"
[menu.docs]
name = "Organization Roles"
identifier = "organization-roles"
parent = "permissions"
weight = 100
+++

# Organization roles

Users can belong to one or more organizations. A user's organization membership is tied to a role that defines what the user is allowed to do in that organization. Grafana supports multiple _organizations_ in order to support a wide variety of deployment models, including using a single Grafana instance to provide service to multiple potentially untrusted organizations.

In most cases, Grafana is deployed with a single organization.

Each organization can have one or more data sources.

All dashboards are owned by a particular organization.

 > **Note:** Most metric databases do not provide per-user series authentication. This means that organization data sources and dashboards are available to all users in a particular organization.

## Organization admin role

Can do everything scoped to the organization. For example:

- Can add, edit, and delete data sources.
- Can add and edit users and teams in their organization.
- Can add, edit, and delete folders containing dashboards for data sources associated with their organization.
- Can configure app plugins and organization settings.
- Can do everything allowed by the Editor role.

## Editor role

- Can view, add, and edit dashboards, panels, and alert rules in dashboards they have access to. This can be disabled on specific folders and dashboards.
- Can create, update, or delete playlists.
- Can access Explore.
- Can add, edit, or delete alert notification channels.
- Cannot add, edit, or delete data sources.
- Cannot manage other organizations, users, and teams.

This role can be changed with the Grafana server setting [editors_can_admin]({{< relref "../administration/configuration.md#editors_can_admin" >}}). If you set this to `true`, then users with the Editor role can also administrate dashboards, folders, and teams they create. This is especially useful for enabling self-organizing teams to administer their own dashboards.

## Viewer role

- Can view any dashboard they have access to. This can be disabled on specific folders and dashboards.
- Cannot add, edit, or delete data sources.
- Cannot add, edit, or delete dashboards or panels.
- Cannot create, update, or delete playlists.
- Cannot add, edit, or delete alert notification channels.
- Cannot access Explore.
- Cannot manage other organizations, users, and teams.

This role can be changed with the Grafana server setting [viewers_can_edit]({{< relref "../administration/configuration.md#viewers-can-edit" >}}). If you set this to `true`, then users with the Viewer role can also make transient dashboard edits, meaning they can modify panels and queries but not save the changes (nor create new dashboards).
This is especially useful for public Grafana installations where you want anonymous users to be able to edit panels and queries but not save or create new dashboards.
