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

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud Advanced](/docs/grafana-cloud/).
{{< /admonition >}}

SCIM streamlines identity management in Grafana by automating user lifecycle and team membership operations. This guide explains how SCIM works with existing Grafana setups, handles user provisioning, and manages team synchronization.

With SCIM, you can:

- **Automate user lifecycle** from creation to deactivation
- **Manage existing users** by linking them with identity provider identities
- **Automate team lifecycle** by automatically creating teams when groups are added, updating team memberships, and deleting teams when groups are removed
- **Maintain security** through automated deprovisioning
- **Replace Team Sync** with more robust SCIM group synchronization

## User provisioning with SCIM

SCIM provisioning works in conjunction with existing user management methods in Grafana. While SCIM automates user provisioning from the identity provider, users can still be created through SAML just-in-time provisioning when they log in, manually through the Grafana UI, or via automation tools like Terraform and the Grafana API. For the most consistent user management experience, we recommend centralizing user provisioning through SCIM.

{{< admonition type="note" >}}
User provisioning requires `user_sync_enabled = true` in the SCIM configuration. See [Configure SCIM in Grafana](../_index.md#configure-scim-in-grafana) for more information.
{{< /admonition >}}

{{< admonition type="warning" >}}
After a user is provisioned through SCIM, they cannot be deleted from Grafana - they can only be deactivated through the identity provider. This is important to consider when planning your user management strategy, especially for compliance and data retention requirements.
{{< /admonition >}}

For detailed configuration steps specific to the identity provider, see:

- [Configure SCIM with Azure AD](../configure-scim-azure/)
- [Configure SCIM with Okta](../configure-scim-okta/)

### How SCIM identifies users

SCIM uses a specific process to establish and maintain user identity between the identity provider and Grafana:

1. Initial user lookup:

   - The identity provider looks up users in Grafana using the user's login and the Unique identifier field (configurable at IdP)
   - The identity provider expects a single result from Grafana for each user

2. Identity linking:

   - The identity provider learns the relationship between the found Grafana user and the Grafana internal ID
   - The identity provider updates Grafana with the External ID
   - Grafana updates the authentication validations to expect this External ID

3. Authentication validation:
   - Grafana expects the SAML integration to return the same External ID in SAML assertions
   - This External ID is used to validate that the logged-in user matches the provisioned user

This process ensures secure and consistent user identification across both systems, preventing security issues that could arise from email changes or other user attribute modifications.

### Existing Grafana users

{{< admonition type="note" >}}
Existing users must be assigned to the Grafana app in the identity provider to maintain access once SCIM is enabled.
{{< /admonition >}}

For users who already exist in the Grafana instance:

- SCIM establishes the relationship through the External ID matching process
- Creates a secure link with the identity provider identity
- Preserves all existing settings and access
- Keeps the account active and unchanged until assigned in the identity provider

#### Handling users from other provisioning methods

To prevent conflicts and maintain consistent user management, disable or restrict other provisioning methods when implementing SCIM. This ensures that all new users are created through SCIM and prevents duplicate or conflicting user records.

- SAML Just-in-Time (JIT) provisioning:

  - Disable `allow_sign_up` in SAML settings to prevent automatic user creation
  - Existing JIT-provisioned users will continue to work but should be migrated to SCIM

- Terraform or API provisioning:

  - Stop creating new users through these methods
  - Existing users will continue to work but should be migrated to SCIM
  - Consider removing or archiving Terraform user creation resources

- Manual user creation:
  - Restrict UI-based user creation to administrators only
  - Plan to migrate manually created users to SCIM

### New users

For users who don't yet exist in Grafana:

- SCIM creates accounts when users are assigned to Grafana in the identity provider
- Sets up initial access based on identity provider group memberships and SAML role mapping
- No manual Grafana account creation needed

### Role management

SCIM handles user synchronization but not role assignments. Role management is handled through [Role Sync](../../configure-authentication/saml#configure-role-sync), and any role changes take effect during user authentication.

## Team provisioning with SCIM

SCIM provides automated team management capabilities that go beyond what Team Sync offers. While Team Sync only maps identity provider groups to existing Grafana teams, SCIM can automatically create and delete teams based on group changes in the identity provider.

{{< admonition type="note" >}}
Team provisioning requires `group_sync_enabled = true` in the SCIM configuration. See [Configure SCIM in Grafana](../_index.md#configure-scim-in-grafana) for more information.
{{< /admonition >}}

{{< admonition type="warning" >}}
Teams provisioned through SCIM cannot be deleted manually from Grafana - they can only be deleted by removing their corresponding groups from the identity provider.
{{< /admonition >}}

For detailed configuration steps specific to the identity provider, see:

- [Configure SCIM with Azure AD](../configure-scim-azure/)
- [Configure SCIM with Okta](../configure-scim-okta/)

### SCIM vs Team Sync

{{< admonition type="warning" >}}
Do not enable both SCIM Group Sync and Team Sync simultaneously as these methods can conflict with each other. However, you can use SCIM for user provisioning while keeping Team Sync for team management until migration support is available.
{{< /admonition >}}

Choose one team synchronization method:

- If you enable SCIM Group Sync, disable Team Sync and use SCIM for team management
- If you prefer Team Sync, do not enable SCIM Group Sync

{{< admonition type="warning" >}}
**Team Sync Migration:** Support for migrating from Team Sync to SCIM Group Sync is coming soon. Until this support is released, we recommend keeping your existing Team Sync setup for team management. You can still benefit from SCIM user provisioning capabilities while using Team Sync for team management.
{{< /admonition >}}

### Key differences

SCIM Group Sync provides several advantages over Team Sync:

- **Automatic team creation:** SCIM automatically creates Grafana teams when new groups are added to the identity provider
- **Automatic team deletion:** SCIM removes teams when their corresponding groups are deleted from the identity provider
- **Real-time updates:** Team memberships are updated immediately when group assignments change
- **Simplified management:** No need to manually create teams in Grafana before mapping them

### How team synchronization works

SCIM manages teams through the following process:

Group assignment:

- User is assigned to groups in the identity provider
- SCIM detects group membership changes

Team creation and mapping:

- Creates Grafana teams for new identity provider groups
- Maps users to appropriate teams
- Removes users from teams when group membership changes

Team membership maintenance:

- Continuously syncs team memberships
- Removes users from teams when removed from groups
- Updates team memberships when groups change
