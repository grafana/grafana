+++
title = "Organization Roles"
description = "Grafana Organization Roles Guide "
keywords = ["grafana", "configuration", "documentation", "organization", "roles", "permissions"]
type = "docs"
[menu.docs]
name = "Organization Roles"
identifier = "organization-roles"
parent = "permissions"
weight = 2
+++

# Organization Roles

Users can belong to one or more organizations. A user's organization membership is tied to a role that defines what the user is allowed to do
in that organization.

## Admin Role

Can do everything scoped to the organization. For example:

- Add and Edit data sources.
- Add and Edit organization users and teams.
- Configure App plugins and set org settings.

## Editor Role

- Can create and modify dashboards and alert rules. This can be disabled on specific folders and dashboards.
- **Cannot** create or edit data sources nor invite new users.

This role can be tweaked via Grafana server setting [editors_can_admin]({{< relref "../installation/configuration.md#editors_can_admin" >}}). If you set this to true users
with **Editor** can also administrate dashboards, folders and teams they create. Useful for enabling self organizing teams.

## Viewer Role

- View any dashboard. This can be disabled on specific folders and dashboards.
- **Cannot** create or edit dashboards nor data sources.

This role can be tweaked via Grafana server setting [viewers_can_edit]({{< relref "../installation/configuration.md#viewers-can-edit" >}}). If you set this to true users
with **Viewer** can also make transient dashboard edits, meaning they can modify panels and queries but not save the changes (nor create new dashboards).
Useful for public Grafana installations where you want anonymous users to be able to edit panels and queries but not save or create new dashboards.
