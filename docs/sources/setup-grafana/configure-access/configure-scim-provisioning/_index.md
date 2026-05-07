---
aliases:
  - ../setup-grafana/configure-security/configure-scim-provisioning/ # /docs/grafana/next/setup-grafana/setup-grafana/configure-security/configure-scim-provisioning/
  - ../configure-security/configure-scim-provisioning/ # /docs/grafana/next/setup-grafana/configure-security/configure-scim-provisioning/
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
weight: 200
---

# Configure SCIM provisioning

System for Cross-domain Identity Management (SCIM) is an open standard that allows automated user provisioning and management. With SCIM, you can automate the provisioning of users and groups from your identity provider to Grafana.

{{< admonition type="note" >}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud/).
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
   - Configure `userUID` SAML assertion in [Entra ID](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-with-azuread/#configure-saml-assertions-when-using-scim-provisioning)
   - Configure `userUID` SAML assertion in [Okta](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-with-okta/#configure-saml-assertions-when-using-scim-provisioning)

### Align SAML identifier with SCIM `externalId`

When you use SAML with SCIM provisioning, align the SCIM `externalId` with the SAML user identifier. Use a stable IdP attribute (for example, Entra ID `user.objectid`) as the SCIM `externalId`, and send that same value as a SAML claim. Configure Grafana to read this claim with the `assertion_attribute_external_uid` setting so SAML authentication links to the SCIM-provisioned user and its permissions.

If the SAML identifier and SCIM `externalId` differ, Grafana may not link the authenticated user to the intended SCIM profile, which can result in incorrect access. Verify your IdP sends a stable, unique identifier and that it matches the SCIM `externalId`. Refer to your IdP docs and the Grafana SCIM integration guides for [Entra ID](configure-scim-with-entraid/) and [Okta](configure-scim-with-okta/) for attribute configuration details.

## Configure SCIM using the Grafana user interface

You can configure SCIM in Grafana using the Grafana user interface. To do this, navigate to **Administration > Authentication > SCIM**.

The Grafana SCIM UI provides the following advantages over configuring SCIM in the Grafana configuration file:

- It is accessible by Grafana Cloud users
- It doesn't require Grafana to be restarted after a configuration update
- Using the authentication settings permission allows us to restrict Grafana’s access scope rather than relying on an overly permissive role such as Admin.

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
- [Configure SCIM with Entra ID](configure-scim-with-entraid/)

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
- For more details about migration and compatibility, see [SCIM vs Team Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-scim-provisioning/manage-users-teams/#scim-vs-team-sync)
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

- [Entra ID](../configure-authentication/azuread/)
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
- [Configure SCIM with Entra ID](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/configure-scim-with-entraid/)
- [Configure SCIM with Okta](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/configure-scim-with-okta/)
