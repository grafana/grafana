---
aliases:
  - ../../user-management/authorization/
  - ../administration/roles-and-permissions/
labels:
  products:
    - enterprise
    - oss
    - cloud
title: User authorization and permissions
menuTitle: Authorization and permissions
description: Assign roles and permissions to control what users and service accounts can access in Grafana.
keywords:
  - RBAC
  - roles
  - permissions
  - authorization
  - access control
weight: 300
---

# Authorize and give permissions to your users

Authorization determines what an authenticated user is allowed to do in Grafana. Permissions are layered from broad to specific:

1. **Server roles** — Grant server-wide administration (self-hosted only).
1. **Organization roles** — Assign Viewer, Editor, or Admin within an organization.
1. **RBAC** — Fine-grained role-based access control (Enterprise and Cloud).
1. **Resource permissions** — Control access to individual folders, dashboards, and data sources.

## Organization roles

Every user has one of three roles within each organization:

| Role   | Description                                                   |
| ------ | ------------------------------------------------------------- |
| Viewer | Read-only access to dashboards and data sources.              |
| Editor | Create and edit dashboards and alerts.                        |
| Admin  | Manage users, teams, data sources, and organization settings. |

A Grafana server admin can also grant the **Server Admin** role, which gives access to all organizations and instance-level settings.

## In this section

- **[RBAC](./rbac/)** — Create custom roles and assign granular permissions (Enterprise and Cloud).
- **[Folder access control](./folder-access-control/)** — Set view, edit, and admin permissions on folders.
- **[Dashboard permissions](./dashboard-permissions/)** — Override folder permissions for individual dashboards.
- **[Organization management](./organization-management/)** — Create and manage organizations to isolate resources across teams.
- **[Organization preferences](./organization-preferences/)** — Configure default theme, timezone, and home dashboard for an organization.

{{< section >}}
