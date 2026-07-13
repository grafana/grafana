---
aliases:
  - ../administration/user-management/
  - ../administration/manage-users-and-permissions/
  - ../administration/roles-and-permissions/
labels:
  products:
    - enterprise
    - oss
    - cloud
title: User management
menuTitle: User management
description: Manage authentication, user identity, and access control in Grafana.
keywords:
  - auth
  - IAM
  - authentication
  - authorization
  - RBAC
  - users
  - permissions
weight: 45
---

# User management

Grafana's user management covers the full lifecycle of access: how users prove who they are, how their accounts exist in the system, and what they're allowed to do.

This section is organized around five topics:

1. **[Authentication](./authentication/)** — Configure how users prove their identity: built-in login, LDAP, SAML, OAuth, JWT, or auth proxy.
1. **[User identity](./user-identity/)** — Manage user accounts, service accounts, teams, and automated provisioning with SCIM.
1. **[Authorization](./authorization/)** — Assign roles and permissions to control what users can access and do.
1. **[API access](./api-access/)** — Authenticate non-human workloads and automations against the Grafana API.
1. **[Audit](./audit/)** — Track and export audit logs and detect leaked credentials.

{{< section >}}

For information about authentication and authorization for your Grafana Cloud Stack and Grafana Cloud Portal, refer to [Grafana Cloud Access Policies](/docs/grafana-cloud/authentication-and-permissions/access-policies/).
