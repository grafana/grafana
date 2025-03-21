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
- **Synchronize team memberships** based on identity provider group assignments
- **Maintain security** through automated deprovisioning
- **Replace Team Sync** with more robust SCIM group synchronization

## User provisioning with SCIM

SCIM provisioning works in conjunction with existing user management methods in Grafana. While SCIM automates user provisioning from the identity provider, users can still be created through SAML just-in-time provisioning when they log in, manually through the Grafana UI, or via automation tools like Terraform and the Grafana API. For the most consistent user management experience, we recommend centralizing user provisioning through SCIM.

For detailed configuration steps specific to the identity provider, see:
  - [Configure SCIM with Azure AD](../configure-scim-azure/)
  - [Configure SCIM with Okta](../configure-scim-okta/)

### How SCIM identifies users

SCIM uses two identifiers to establish and maintain user identity between the identity provider and Grafana:

1. Email address:
   - Used for initial user matching
   - Can change over time
   - Included in SAML NameID

2. Identity provider user ID:
   - Unique, permanent identifier from the identity provider
   - Stored as `externalId` in SCIM
   - Must match between SAML assertions and SCIM
   - Prevents security issues from email changes

### Existing Grafana users

{{< admonition type="note" >}}
Existing users must be assigned to the Grafana app in the identity provider to maintain access once SCIM is enabled.
{{< /admonition >}}

For users who already exist in the Grafana instance:

- SCIM matches them by email address
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