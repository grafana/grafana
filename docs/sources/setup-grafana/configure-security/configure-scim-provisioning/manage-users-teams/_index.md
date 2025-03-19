---
description: Learn how to implement SCIM provisioning in Grafana for automated user and team synchronization. SCIM integrates with identity providers like Okta and Azure AD to streamline user management, automate team provisioning, and replace Team Sync.
keywords:
  - grafana
  - scim
  - provisioning
  - user-management
  - team-management
labels:
  products:
    - cloud
    - enterprise
menuTitle: Manage users and teams with SCIM
title: Manage users and teams with SCIM
weight: 310
---

# Manage users and teams with SCIM

SCIM streamlines identity management in Grafana by automating user lifecycle and team membership operations. This guide provides detailed instructions for managing user provisioning, configuring team synchronization, and transitioning from Team Sync to SCIM Group Sync. You'll learn how to handle user updates, manage team memberships, and troubleshoot common provisioning scenarios.

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud Advanced](/docs/grafana-cloud/).
{{< /admonition >}}

## Overview

With SCIM, you can:

- **Automate user management** by provisioning and updating users directly from Okta and Azure AD, including automatic profile updates when user details change
- **Streamline team operations** through automatic team creation and membership management based on identity provider group assignments
- **Enhance security** with automatic user deprovisioning when users are removed from the identity provider
- **Maintain team consistency** by automatically removing or archiving teams when corresponding groups are deleted in the identity provider
- **Simplify onboarding** by automatically granting new users access to teams based on the identity provider group memberships

## User provisioning with SCIM

User provisioning with SCIM automates the creation, update, and deactivation of user accounts in Grafana. When users are assigned to the Grafana SCIM app in the identity provider, SCIM automatically creates and configures their accounts.

### SCIM and other provisioning methods

While SCIM handles automated user provisioning from identity providers, it can coexist with other provisioning methods in Grafana:

- SCIM automatically creates and updates users from Okta and Azure AD
- Additional user provisioning can occur through:
  - SAML sign-in (when `allow_sign_up` is enabled)
  - Grafana UI
  - Automation tools like Terraform
  - API-based creation

For consistent user management, we recommend using SCIM as the primary provisioning method.

### Role management

SCIM handles user synchronization, but role management works differently:

- SCIM synchronizes users but does not manage roles
- Role assignments are handled through [Role Sync](../../configure-authentication/saml#configure-role-sync)
- Role changes take effect when users authenticate through SAML

For role management, continue using Role Sync to map users to appropriate roles in Grafana.

### User update behavior

When a user's name or email changes in the identity provider, SCIM automatically updates the corresponding information in Grafana.

### Deprovisioning behavior

SCIM handles the following deprovisioning scenarios:

- When removing a user from the identity provider, Grafana disables the user account but does not delete it
- When manually deleting a user in Grafana, SCIM may recreate the user account during the next sync
- When changing a user email in the identity provider, Grafana updates the email if it is properly mapped in SCIM

## Team provisioning with SCIM

### SCIM and Team Sync

{{< admonition type="warning" >}}
Do not enable both SCIM and Team Sync simultaneously as these methods can conflict with each other.
{{< /admonition >}}

Choose one synchronization method:

- If you enable SCIM, disable Team Sync and use SCIM for team management
- If you prefer Team Sync, do not enable SCIM provisioning

### Configure SCIM Group Sync

To enable **SCIM Group Sync**, set the sync mode in your Grafana configuration file:

```ini
[auth]
team_sync_mode = "scim_sync"
mapping_mode = "strict|create"
```

| **Setting**                    | **Description**                                         |
| ------------------------------ | ------------------------------------------------------- |
| `team_sync_mode = "scim_sync"` | Enables SCIM Group Sync (disables Team Sync).           |
| `mapping_mode = "strict"`      | Only syncs teams if explicitly mapped in Grafana.       |
| `mapping_mode = "create"`      | Automatically creates new Grafana teams for IdP groups. |

### How SCIM maps users to teams

1. User is assigned to a group in the identity provider (Okta or Azure AD)
2. SCIM automatically creates a corresponding Grafana team if it does not exist
3. SCIM syncs users into teams based on their identity provider group assignments
4. If a user is removed from the identity provider group, they are removed from the Grafana team

## Migrating from Team Sync to SCIM Group Sync

// TODO
