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
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and to customers on select Grafana Cloud plans. For pricing information, visit [pricing](https://grafana.com/pricing/) or contact our sales team.
{{< /admonition >}}

{{< admonition type="warning" >}}
**Public Preview:** SCIM provisioning is currently in Public Preview. While functional, the feature is actively being refined and may undergo changes. We recommend thorough testing in non-production environments before deploying to production systems.
{{< /admonition >}}

This guide explains how to configure SCIM provisioning with Azure AD to automate user and team management in Grafana.

{{< admonition type="note" >}}
This feature is behind the `enableSCIM` feature toggle.
You can enable feature toggles through configuration file or environment variables.

For more information, refer to the [feature toggles documentation](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles).
{{< /admonition >}}

{{< admonition type="note" >}}
**Important SAML and SCIM Configuration:**
When using SAML for authentication alongside SCIM provisioning with Azure AD, it is crucial to correctly align user identifiers.
For detailed information on why this is critical for security and how to configure it, refer to the main [SCIM provisioning documentation](../).

Refer to the [SAML authentication with Azure AD documentation](../../configure-authentication/saml/configure-saml-with-azuread/) for specific instructions on how to configure SAML claims and Grafana SAML settings for your Azure AD SCIM setup.
{{< /admonition >}}

## Prerequisites

Before configuring SCIM with Azure AD, ensure you have:

- Grafana Enterprise or a paid Grafana Cloud account with SCIM provisioning enabled.
- Admin access to both Grafana and Azure AD
- SCIM feature enabled in Grafana

## Configure SCIM in Grafana

To enable SCIM provisioning in Grafana, create a service account and generate a service account token that will be used to authenticate SCIM requests from Azure AD.

### Create a service account

1. Navigate to **Administration > Users and access > Service accounts**
2. Click **Add service account**
3. Create a new service account with Admin role
4. Create a new token for the newly created service account and save it securely
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

- **Tenant URL:**
  - For Grafana Cloud instances:
    ```
    https://{stack-name}.grafana.net/apis/scim.grafana.app/v0alpha1/namespaces/stacks-{stack-id}
    ```
    Replace `{stack-name}` and `{stack-id}` with your Grafana Cloud stack name and ID.
  - For self-hosted instances:
    ```
    https://{your-grafana-domain}/apis/scim.grafana.app/v0alpha1/namespaces/default
    ```
    Replace `{your-grafana-domain}` with your Grafana instance's domain (e.g., `grafana.yourcompany.com`).
- **Secret Token:** Enter the service account token from Grafana

4. Click **Test connection** to verify the configuration
5. Click **Create** to save the settings

### Configure attribute mappings

After setting the Tenant URL and Secret Token, navigate to the **Mappings** section within the same **Provisioning** settings in your Azure AD enterprise application and then click **Provision Microsoft Entra ID Users**. This is where you will define how Azure AD attributes correspond to the SCIM attributes for Grafana, including the mandatory `externalId`.

{{< admonition type="note" >}}

- Only work email addresses are supported. Azure AD must be configured to use `emails[type eq "work"].value` for email mapping.
- The `externalId` attribute in Grafana is mandatory. Azure AD uses this to uniquely identify users and groups. You must map an attribute from Azure AD to the `externalId` attribute in Grafana. This Azure AD attribute must be **a stable and a unique identifier for each individual user** (for example, the `objectId` attribute in Azure AD is commonly used for this purpose).

{{< /admonition >}}

Configure the following required attributes:

| Azure AD Attribute                                            | Grafana Attribute              |
| ------------------------------------------------------------- | ------------------------------ |
| `userPrincipalName`                                           | `userName`                     |
| `mail`                                                        | `emails[type eq "work"].value` |
| `displayName`                                                 | `displayName`                  |
| `objectId`                                                    | `externalId`                   |
| `Switch([IsSoftDeleted], , "False", "True", "True", "False")` | `active`                       |

### Enable provisioning

Click **Start provisioning** from the top action bar in the **Overview** page from your Azure AD enterprise application.

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
