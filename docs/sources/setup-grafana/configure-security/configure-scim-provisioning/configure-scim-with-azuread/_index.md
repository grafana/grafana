---
description: Learn how to configure SCIM provisioning with Azure AD in Grafana Enterprise. This guide provides step-by-step instructions for setting up automated user and team management, including enterprise application configuration, service account creation, attribute mapping, and provisioning settings to ensure seamless integration between Azure AD and Grafana.
keywords:
  - grafana
  - scim
  - azure
  - azure ad
  - entra id
  - provisioning
  - user-management
  - team-management
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SCIM with Azure AD
title: Configure SCIM with Azure AD
weight: 320
---

# Configure SCIM with Azure AD

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud Advanced](/docs/grafana-cloud/).
{{< /admonition >}}

This guide explains how to configure SCIM provisioning with Azure AD to automate user and team management in Grafana.

{{< admonition type="note" >}}
This feature is behind the `enableSCIM` feature toggle.
You can enable feature toggles through configuration file or environment variables.

For more information, refer to the [feature toggles documentation](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles).
{{< /admonition >}}

## Prerequisites

Before configuring SCIM with Azure AD, ensure you have:

- Grafana Enterprise or Grafana Cloud Advanced
- Admin access to both Grafana and Azure AD
- [SAML authentication configured with Azure AD](../../configure-authentication/saml/#set-up-saml-with-azure-ad)
- SCIM feature enabled in Grafana

## Configure SCIM in Grafana

To enable SCIM provisioning in Grafana, create a service account and generate a service account token that will be used to authenticate SCIM requests from Azure AD.

### Create a service account

1. Navigate to **Administration > User Access > Service accounts**
2. Click **Add new service account**
3. Create a new access token and save it securely
   - This token will be used in the Azure AD configuration

## Configure SCIM in Azure AD

Configure the enterprise application in Azure AD to enable automated user and team synchronization with Grafana. This involves creating a new application and setting up both authentication and provisioning.

### Create the enterprise application

1. Open Azure Portal Entra ID (Azure AD)
2. Click **+ Add** dropdown
3. Click **Add Enterprise Application**
4. Click **+ Create Your Own Application**
5. Name the application and select **non-gallery**

### Configure provisioning

1. In the application overview, select **Provisioning**
2. Click **+ New Configuration**
3. Configure the following settings:
   - **Tenant URL:** `https://{grafana_url}/scim`
   - **Secret Token:** Enter the service account token from Grafana
4. Click **Test connection** to verify the configuration
5. Click **Create** to save the settings

### Configure attribute mappings

{{< admonition type="note" >}}
Only work email addresses are supported. Azure AD must be configured to use `emails[type eq "work"].value` for email mapping.
{{< /admonition >}}

Configure the following required attributes:

| Azure AD Attribute. | Grafana Attribute              |
| ------------------- | ------------------------------ |
| `userPrincipalName` | `userName`                     |
| `mail`              | `emails[type eq "work"].value` |
| `displayName`       | `displayName`                  |

### Enable provisioning

1. Set **Provisioning Status** to **On**
2. Configure the following settings:
   - **Scope:** Select which users and groups to sync
   - **Create users:** Enabled
   - **Update users:** Enabled
   - **Delete users:** Convert to disabled
   - **Create groups:** Enabled
   - **Update groups:** Enabled
   - **Delete groups:** Disabled

### Configure group provisioning

To enable group synchronization:

1. Navigate to the **Groups** tab in provisioning
2. Enable **Group provisioning**
3. Select the groups to synchronize with Grafana
4. Save the changes

## Test the integration

After completing the configuration:

1. Test the SCIM connector in Azure AD
2. Assign a test user to the application
3. Verify the user is provisioned in Grafana
4. Test group synchronization if configured

## Troubleshooting

For common issues and solutions when working with SCIM provisioning, refer to the [SCIM troubleshooting guide](../troubleshooting/).
