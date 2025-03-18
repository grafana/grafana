---
aliases:
  - ../../auth/scim/
  - ../../enterprise/scim/
description: Learn how to use SCIM provisioning to synchronize users and groups from your identity provider to Grafana.
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

{{% admonition type="note" %}}
This feature is behind the `enableSCIM` feature toggle.
You can enable feature toggles through configuration file or environment variables. See configuration [docs](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles) for details.
{{% /admonition %}}

## Benefits of SCIM provisioning

SCIM provisioning offers several advantages for managing users and teams in Grafana:

- **Automated user provisioning**: Automatically create, update, and disable users in Grafana when changes occur in your identity provider.
- **Automated team provisioning**: Automatically create, update, and delete teams in Grafana based on groups in your identity provider, and synchronize team memberships.
- **Reduced administrative overhead**: Eliminate manual user management tasks and reduce the risk of human error.
- **Enhanced security**: Automatically disable access when users leave your organization, ensuring proper access control and compliance with security policies.

{{% admonition type="note" %}}
SCIM provisioning currently works **only with SAML authentication**. Other authentication methods are not supported.
{{% /admonition %}}

## Supported identity providers

The SCIM provisioning feature in Grafana currently supports:

- [Azure AD](../configure-authentication/azuread/)
- [Okta](../configure-authentication/saml/)

## How SCIM provisioning works

SCIM provisioning works by establishing a connection between your identity provider and Grafana:

1. You configure SCIM in both your identity provider and Grafana.
2. Your identity provider sends SCIM requests to the Grafana SCIM API endpoint.
3. Grafana processes these requests to create, update, or deactivate users and teams, and synchronize team memberships.

## Comparing SCIM with other user sync methods

Grafana offers several methods for synchronizing users, teams, and roles. The table below compares SCIM with other synchronization methods to help you understand its advantages:

| Sync Method                                                                    | Users | Teams | Roles | Automation | Key Benefits                                                             | Limitations                                                  | On-Prem | Cloud |
| ------------------------------------------------------------------------------ | ----- | ----- | ----- | ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------- | ----- |
| SCIM                                                                           | ✅    | ✅    | ⚠️    | Partial    | Complete user and team lifecycle management with automatic team creation | Requires SAML authentication; uses Role Sync for basic roles | ✅      | ✅    |
| [Team Sync](../configure-team-sync/)                                           | ❌    | ✅    | ❌    | Partial    | Maps identity provider groups to Grafana teams                           | Requires manual team creation                                | ✅      | ✅    |
| [Active LDAP Sync](../configure-authentication/enhanced-ldap/)                 | ✅    | ❌    | ❌    | Full       | Background synchronization of LDAP users                                 | Limited to LDAP environments                                 | ✅      | ❌    |
| [Group Attribute Sync](../configure-group-attribute-sync/)                     | ❌    | ❌    | ✅    | Partial    | Maps identity provider group attributes to permissions                   | Limited to identity provider attributes                      | ✅      | ✅    |
| [Role Sync](../configure-authentication/saml#configure-role-sync)              | ❌    | ❌    | ✅    | Partial    | Maps basic roles to users                                                | Limited to basic roles only                                  | ✅      | ✅    |
| [Org Mapping](../configure-authentication/saml#configure-organization-mapping) | ❌    | ❌    | ✅    | Partial    | Maps basic roles per organization                                        | Only available for on-premises deployments                   | ✅      | ❌    |

### Key advantages of SCIM over other methods

- **Complete automation**: SCIM is the only method that fully automates user and team provisioning.
- **Dynamic team creation**: Teams are created automatically based on identity provider groups, eliminating manual setup.
- **Near real-time synchronization**: Changes in your identity provider are reflected in Grafana based on your identity provider synchronization schedule (consult your identity provider documentation for specific details).
- **Enterprise-ready**: Designed for large organizations with complex user management needs.

## Important considerations when using SCIM

### SCIM and Team Sync

{{% admonition type="warning" %}}
Do not enable both SCIM and Team Sync simultaneously. These methods can conflict with each other, leading to unexpected behavior.
{{% /admonition %}}

SCIM and Team Sync are alternative methods for synchronizing teams:

- If you enable SCIM, disable Team Sync and use SCIM for team management.
- If you prefer Team Sync, do not enable SCIM provisioning

For more information, see [Managing users and teams via SCIM provisioning](managing-users-teams/).

### SCIM and user provisioning

SCIM can coexist with other user provisioning methods:

- SCIM handles automated user creation and updates from your identity provider.
- Users can still be created through other methods:
  - Automatic creation when users sign in with SAML (when `allow_sign_up` is enabled).
  - Manual creation through the Grafana UI.
  - Provisioning through automation tools like Terraform.
  - API-based user creation.

For the most consistent experience, we recommend establishing SCIM as the primary method for user management and carefully considering which additional provisioning methods to enable.

### SCIM and role mapping

While SCIM manages users and teams, role assignment currently works as follows:

- SCIM does not directly handle role assignments.
- Continue to use [Role Sync](../configure-authentication/saml#configure-role-sync) to map users to basic roles.
- Role assignments occur when users log in through your authentication provider.

This hybrid approach allows you to automate user and team management with SCIM while still leveraging existing role mapping capabilities.

## Next steps

- [Configure SCIM with Azure AD](azuread/)
- [Configure SCIM with Okta](okta/)
- [Managing users and teams via SCIM provisioning](managing-users-teams/)
