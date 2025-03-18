---
description: Learn how to use SCIM provisioning to synchronize users and groups from your identity provider to Grafana. SCIM enables automated user management, team provisioning, and enhanced security through real-time synchronization with your identity provider.
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
menuTitle: Configure SCIM provisioning
title: Configure SCIM provisioning
weight: 300
---

# Configure SCIM provisioning

System for Cross-domain Identity Management (SCIM) is an open standard that allows automated user provisioning and management. With SCIM, you can automate the provisioning of users and groups from your identity provider to Grafana.

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud Advanced](/docs/grafana-cloud/).
{{< /admonition >}}

{{< admonition type="note" >}}
This feature is behind the `enableSCIM` feature toggle.
You can enable feature toggles through configuration file or environment variables.

For more information, refer to the [feature toggles documentation](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles).
{{< /admonition >}}

## Benefits

{{< admonition type="note" >}}
SCIM provisioning only works SAML authentication.
Other authentication methods aren't supported.
{{< /admonition >}}

SCIM offers several advantages for managing users and teams in Grafana:

- **Automated user provisioning**: Automatically create, update, and disable users in Grafana when changes occur in your identity provider
- **Automated team provisioning**: Automatically create, update, and delete teams in Grafana based on groups in your identity provider
- **Reduced administrative overhead**: Eliminate manual user management tasks and reduce the risk of human error
- **Enhanced security**: Automatically disable access when users leave your organization

## Supported identity providers

The following identity providers are supported:

- [Azure AD](../configure-authentication/azuread/)
- [Okta](../configure-authentication/saml/)

## How it works

The synchronization process works as follows:

1. Configure SCIM in both your identity provider and Grafana
2. Your identity provider sends SCIM requests to the Grafana SCIM API endpoint
3. Grafana processes these requests to create, update, or deactivate users and teams, and synchronize team memberships

## Comparison with other sync methods

Grafana offers several methods for synchronizing users, teams, and roles.
The following table compares SCIM with other synchronization methods to help you understand its advantages:

| Sync Method                                                                    | Users | Teams | Roles | Automation | Key Benefits                                                             | Limitations                                                  | On-Prem | Cloud |
| ------------------------------------------------------------------------------ | ----- | ----- | ----- | ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------- | ----- |
| SCIM                                                                           | ✅    | ✅    | ⚠️    | Partial    | Complete user and team lifecycle management with automatic team creation | Requires SAML authentication; uses Role Sync for basic roles | ✅      | ✅    |
| [Team Sync](../configure-team-sync/)                                           | ❌    | ✅    | ❌    | Partial    | Maps identity provider groups to Grafana teams                           | Requires manual team creation                                | ✅      | ✅    |
| [Active LDAP Sync](../configure-authentication/enhanced-ldap/)                 | ✅    | ❌    | ❌    | Full       | Background synchronization of LDAP users                                 | Limited to LDAP environments                                 | ✅      | ❌    |
| [Group Attribute Sync](../configure-group-attribute-sync/)                     | ❌    | ❌    | ✅    | Partial    | Maps identity provider group attributes to permissions                   | Limited to identity provider attributes                      | ✅      | ✅    |
| [Role Sync](../configure-authentication/saml#configure-role-sync)              | ❌    | ❌    | ✅    | Partial    | Maps basic roles to users                                                | Limited to basic roles only                                  | ✅      | ✅    |
| [Org Mapping](../configure-authentication/saml#configure-organization-mapping) | ❌    | ❌    | ✅    | Partial    | Maps basic roles per organization                                        | Only available for on-premises deployments                   | ✅      | ❌    |

### Key advantages

- **Complete automation**: SCIM is the only method that fully automates user and team provisioning
- **Dynamic team creation**: Teams are created automatically based on identity provider groups
- **Near real-time synchronization**: Changes in your identity provider are reflected based on the provider's synchronization schedule
- **Enterprise-ready**: Designed for large organizations with complex user management needs

## Important considerations

When implementing SCIM, you need to understand how it interacts with other Grafana features and authentication methods. The following sections explain key integration points and potential conflicts to help you make informed decisions about your configuration.

### SCIM and Team Sync

{{< admonition type="warning" >}}
Do not enable both SCIM and Team Sync simultaneously as these methods can conflict with each other.
{{< /admonition >}}

Choose one synchronization method:

- If you enable SCIM, disable Team Sync and use SCIM for team management.
- If you prefer Team Sync, do not enable SCIM provisioning

For more information, refer to [Managing users and teams via SCIM provisioning](managing-users-teams/).

### SCIM and user provisioning

SCIM can work alongside other user provisioning methods:

- SCIM handles automated user creation and updates from your identity provider
- Users can still be created through:
  - SAML sign-in (when `allow_sign_up` is enabled)
  - Grafana UI
  - Automation tools like Terraform
  - API-based creation

For consistency, we recommend using SCIM as your primary user management method.

### SCIM and role mapping

SCIM handles user and team synchronization, but role management works differently. Here's how roles are managed:

- SCIM synchronizes users and teams but does not manage roles
- Role assignments are handled through [Role Sync](../configure-authentication/saml#configure-role-sync)
- Role changes take effect when users authenticate through SAML

For role management, continue using Role Sync to map users to their appropriate roles in Grafana. This separation of concerns allows you to maintain flexible role assignments while benefiting from SCIM's automated user and team management.

## Next steps

- [Configure SCIM with Azure AD](azuread/)
- [Configure SCIM with Okta](okta/)
- [Manage users and teams with SCIM provisioning](manage-users-teams/)
