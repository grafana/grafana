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
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and select Grafana Cloud plans in [public preview](https://grafana.com/docs/release-life-cycle/).
Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

{{< admonition type="warning" >}}
**Public Preview:** SCIM provisioning is currently in Public Preview. While functional, the feature is actively being refined and may undergo changes. We recommend thorough testing in non-production environments before deploying to production systems.
{{< /admonition >}}

{{< admonition type="note" >}}
This feature is behind the `enableSCIM` feature toggle.
You can enable feature toggles through configuration file or environment variables.

For more information, refer to the [feature toggles documentation](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles).
{{< /admonition >}}

{{< admonition type="warning" title="Critical: Aligning SAML Identifier with SCIM externalId" >}}
When using SAML for authentication alongside SCIM provisioning, a critical security measure is to ensure proper alignment between the the SCIM user's `externalId` and the SAML user identifier. The unique identifier used for SCIM provisioning (which becomes the `externalId` in Grafana, often sourced from a stable IdP attribute like Azure AD's `user.objectid`) **must also be sent as a claim in the SAML assertion from your Identity Provider.**
Furthermore, the Grafana SAML configuration must be correctly set up to identify and use this specific claim for linking the authenticated SAML user to their SCIM-provisioned user. This can be achieved by either ensuring the primary SAML login identifier by using the `assertion_attribute_external_uid` setting in Grafana to explicitly set the name of the SAML claim that contains the stable unique identifier attribute.

**Why is this important?**
A mismatch or inconsistent mapping between this SAML login identifier and the SCIM `externalId` creates a critical security vulnerability. If these two identifiers are not reliably and uniquely aligned for each individual user, Grafana may fail to correctly link an authenticated SAML session to the intended SCIM-provisioned user profile and its associated permissions. This can enable a malicious actor to impersonate another user—for instance, by crafting a SAML assertion that, due to the identifier misalignment, incorrectly grants them the access rights of the targeted user.

Grafana relies on this linkage to correctly associate the authenticated user from SAML with the provisioned user from SCIM. Failure to ensure a consistent and unique identifier across both systems can break this linkage, leading to incorrect user mapping and potential unauthorized access.

Always verify that your SAML identity provider is configured to send a stable, unique user identifier that your SCIM configuration maps to `externalId`. Refer to your identity provider's documentation and the specific Grafana SCIM integration guides (e.g., for [Azure AD](configure-scim-with-azuread/) or [Okta](configure-scim-with-okta/)) for detailed instructions on configuring these attributes correctly.
{{< /admonition >}}

## Benefits

{{< admonition type="note" >}}
SCIM provisioning only works with SAML authentication.
Other authentication methods aren't supported.
{{< /admonition >}}

SCIM offers several advantages for managing users and teams in Grafana:

- **Automated user provisioning**: Automatically create, update, and disable users in Grafana when changes occur in your identity provider
- **Automated team lifecycle management**: Automatically create teams when new groups are added, update team memberships, and delete teams when groups are removed from your identity provider
- **Reduced administrative overhead**: Eliminate manual user management tasks and reduce the risk of human error
- **Enhanced security**: Automatically disable access when users leave your organization

## Authentication and access requirements

When you enable SCIM in Grafana, the following requirements and restrictions apply:

1. **Use the same identity provider for user provisioning and for authentication flow**: You must use the same identity provider for both authentication and user provisioning.

2. **Security restriction**: When using SAML, the login authentication flow requires the SAML assertion exchange between the Identity Provider and Grafana to include the `userUID` SAML assertion with the user's unique identifier at the Identity Provider.
   - Configure `userUID` SAML assertion in [Azure AD](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/saml/configure-saml-with-azuread/#configure-saml-assertions-when-using-scim-provisioning)
   - Configure `userUID` SAML assertion in [Okta](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/saml/configure-saml-with-okta/#configure-saml-assertions-when-using-scim-provisioning)

## Configure SCIM using the Grafana user interface

You can configure SCIM in Grafana using the Grafana user interface. To do this, navigate to **Administration > Authentication > SCIM**.

The Grafana SCIM UI provides the following advantages over configuring SCIM in the Grafana configuration file:

- It is accessible by Grafana Cloud users
- It doesn't require Grafana to be restarted after a configuration update
- Access to the SCIM UI only requires access to authentication settings, so it can be used by users with limited access to Grafana's configuration

{{< admonition type="note" >}}
Any configuration changes made through the Grafana user interface (UI) will take precedence over settings specified in the Grafana configuration file or through environment variables. This means that if you modify any configuration settings in the UI, they will override any corresponding settings set via environment variables or defined in the configuration file.
{{< /admonition >}}

### Configure SCIM settings

Sign in to Grafana and navigate to **Administration > Authentication > SCIM**. Here you can configure the following settings:

| Setting                        | Required | Description                                                                                                                                                                                | Default |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `Enable Group Sync`            | No       | Enable SCIM group provisioning. When enabled, Grafana will create, update, and delete teams based on SCIM requests from your identity provider. Cannot be enabled if Team Sync is enabled. | `false` |
| `Reject Non-Provisioned Users` | No       | When enabled, prevents non-SCIM provisioned users from signing in. Cloud Portal users can always sign in regardless of this setting.                                                       | `false` |
| `Enable User Sync`             | Yes      | Enable SCIM user provisioning. When enabled, Grafana will create, update, and deactivate users based on SCIM requests from your identity provider.                                         | `false` |

The SCIM UI also displays information that may help you configure SCIM in your identity provider, including stack domain, stack ID, and tenant URL.

### Next steps

After configuring SCIM in Grafana, configure your identity provider:

- [Configure SCIM with Okta](configure-scim-with-okta/)
- [Configure SCIM with Azure AD](configure-scim-with-azuread/)

## Configure SCIM using the configuration file

The table below describes all SCIM configuration options. Like any other Grafana configuration, you can apply these options as [environment variables](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#override-configuration-with-environment-variables).

| Setting                        | Required | Description                                                                                                                                                                                | Default |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `user_sync_enabled`            | Yes      | Enable SCIM user provisioning. When enabled, Grafana will create, update, and deactivate users based on SCIM requests from your identity provider.                                         | `false` |
| `group_sync_enabled`           | No       | Enable SCIM group provisioning. When enabled, Grafana will create, update, and delete teams based on SCIM requests from your identity provider. Cannot be enabled if Team Sync is enabled. | `false` |
| `reject_non_provisioned_users` | No       | When enabled, prevents non-SCIM provisioned users from signing in. Cloud Portal users can always sign in regardless of this setting.                                                       | `false` |

{{< admonition type="warning" >}}
**Team Sync Compatibility**:

- SCIM group sync (`group_sync_enabled = true`) and Team Sync cannot be enabled simultaneously
- You can use SCIM user sync (`user_sync_enabled = true`) alongside Team Sync
- For more details about migration and compatibility, see [SCIM vs Team Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-scim-provisioning/manage-users-teams/#scim-vs-team-sync)
  {{< /admonition >}}

### Example SCIM configuration

```ini
[auth.scim]
user_sync_enabled = true
group_sync_enabled = false
reject_non_provisioned_users = false
```

## Configure SCIM using Terraform

You can also configure SCIM provisioning in Grafana using the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/scim_config). This approach is particularly useful for infrastructure-as-code deployments and automated provisioning.

### Terraform SCIM configuration example

```hcl
resource "grafana_scim_config" "scim_config" {
  user_sync_enabled            = true
  group_sync_enabled           = false
  reject_non_provisioned_users = false
}
```

### Terraform SCIM configuration options

The Terraform `grafana_scim_config` resource supports the same configuration options as the manual configuration:

| Setting                        | Required | Description                                                                                                                                                                                | Default |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `user_sync_enabled`            | Yes      | Enable SCIM user provisioning. When enabled, Grafana will create, update, and deactivate users based on SCIM requests from your identity provider.                                         | `false` |
| `group_sync_enabled`           | No       | Enable SCIM group provisioning. When enabled, Grafana will create, update, and delete teams based on SCIM requests from your identity provider. Cannot be enabled if Team Sync is enabled. | `false` |
| `reject_non_provisioned_users` | No       | When enabled, prevents non-SCIM provisioned users from signing in. Cloud Portal users can always sign in regardless of this setting.                                                       | `false` |

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
The following table compares SCIM with other synchronization methods to help you understand the advantages:

| Sync Method                                                                    | Users | Teams | Roles | Automation | Key Benefits                                                             | Limitations                                                  | On-Prem | Cloud |
| ------------------------------------------------------------------------------ | ----- | ----- | ----- | ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------- | ----- |
| SCIM                                                                           | ✅    | ✅    | ⚠️    | Full       | Complete user and team lifecycle management with automatic team creation | Requires SAML authentication; uses Role Sync for basic roles | ✅      | ✅    |
| [Team Sync](../configure-team-sync/)                                           | ❌    | ⚠️    | ❌    | Partial    | Syncs team memberships to existing teams                                 | Requires manual team creation; no team lifecycle management  | ✅      | ✅    |
| [Active LDAP Sync](../configure-authentication/enhanced-ldap/)                 | ✅    | ❌    | ❌    | Full       | Background synchronization of LDAP users                                 | Limited to LDAP environments                                 | ✅      | ❌    |
| [Role Sync](../configure-authentication/saml#configure-role-sync)              | ❌    | ❌    | ✅    | Full       | Full automation of basic role assignment                                 | Limited to basic roles only                                  | ✅      | ✅    |
| [Org Mapping](../configure-authentication/saml#configure-organization-mapping) | ❌    | ❌    | ⚠️    | Full       | Full automation of basic role assignment per organization                | Limited to basic roles only; on-premises only                | ⚠️      | ❌    |

### Key advantages

- **Comprehensive user and team automation**: SCIM provides full automation for user and team provisioning, while role management is handled separately through Role Sync
- **Dynamic team creation**: Teams are created automatically based on identity provider groups
- **Near real-time synchronization**: Changes in the identity provider are reflected based on the provider synchronization schedule
- **Enterprise-ready**: Designed for large organizations with complex user management needs

## Next steps

- [Manage users and teams with SCIM provisioning](manage-users-teams/)
- [Troubleshoot SCIM provisioning](troubleshooting/)
- [Configure SCIM with Azure AD](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-scim-provisioning/configure-scim-with-azuread/)
- [Configure SCIM with Okta](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-scim-provisioning/configure-scim-with-okta/)
