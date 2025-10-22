---
description: Learn how to configure SCIM provisioning with Okta in Grafana. This guide provides step-by-step instructions for setting up automated user and team management, including SAML configuration, service account creation, attribute mapping, and provisioning settings to ensure seamless integration between Okta and Grafana.
keywords:
  - grafana
  - scim
  - okta
  - provisioning
  - user-management
  - team-management
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SCIM with Okta
title: Configure SCIM with Okta
weight: 320
---

# Configure SCIM with Okta

{{< admonition type="note" >}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and to customers on select Grafana Cloud plans. For pricing information, visit [pricing](https://grafana.com/pricing/) or contact our sales team.
{{< /admonition >}}

{{< admonition type="warning" >}}
**Public Preview:** SCIM provisioning is currently in Public Preview. While functional, the feature is actively being refined and may undergo changes. We recommend thorough testing in non-production environments before deploying to production systems.
{{< /admonition >}}

This guide explains how to configure SCIM provisioning with Okta to automate user and team management in Grafana.

{{< admonition type="note" >}}
This feature is behind the `enableSCIM` feature toggle.
You can enable feature toggles through configuration file or environment variables.

For more information, refer to the [feature toggles documentation](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles).
{{< /admonition >}}

## Prerequisites

Before configuring SCIM with Okta, ensure you have:

- Grafana Enterprise or a paid Grafana Cloud account with SCIM provisioning enabled.
- Admin access to both Grafana and Okta
- [SAML authentication configured with Okta](../../configure-authentication/saml/configure-saml-with-okta/)
- SCIM feature enabled in Grafana

{{< admonition type="note" >}}
**Important SAML and SCIM Configuration:**
When using SAML for authentication alongside SCIM provisioning with Okta, it is crucial to correctly align user identifiers.
For detailed information on why this is critical for security and how to configure it, refer to the main [SCIM provisioning documentation](../).

Ensure your Okta SAML application is configured to send a stable, unique identifier (that will map to the Grafana SCIM `externalId`) as a SAML claim. Then, configure the Grafana SAML settings to use this claim. For general Okta SAML setup, refer to [Set up SAML with Okta](../../configure-authentication/saml/configure-saml-with-okta/).
{{< /admonition >}}

## Configure SCIM in Grafana

To enable SCIM provisioning in Grafana, create a service account and generate an access token that will be used to authenticate SCIM requests from Okta.

### Create a service account

1. Navigate to **Administration > Users and access > Service accounts**
2. Click **Add service account**
3. Create a new service account with **Role: "None"**
4. In the service account **Permissions** tab, add these permissions:

   **Allow the service account to sync users:**
   - `org.users:read`
   - `org.users:write`
   - `org.users:add`
   - `org.users:remove`

   **Allow the service account to sync groups:**
   - `teams:read`
   - `teams:create`
   - `teams:write`
   - `teams:delete`

5. Create a new token for the newly created service account and save it securely
   - This token will be used in the Okta configuration

## Configure SCIM in Okta

Configure both SAML authentication and SCIM provisioning in Okta to enable automated user and team synchronization with Grafana. Start by creating a SAML application, then enable and configure SCIM provisioning for that application.

### Enable SCIM provisioning

1. Navigate to the **General** tab of your SAML App Integration in Okta
2. Enable SCIM provisioning
   - A new provisioning tab will appear

### Configure provisioning settings

To enable user provisioning through SCIM, configure the SCIM integration settings in Grafana by specifying the connector URL, authentication mode, and supported provisioning actions. Follow these steps to complete the integration.

### Configure SCIM integration

In the **Integration** tab, configure:

- **SCIM Connector base URL:**

  You can copy the complete SCIM Connector base URL directly from the SCIM UI at **Administration > Authentication > SCIM**. This is displayed as the Tenant URL in the UI. Your stack domain and stack ID can also be found in the SCIM UI.

  Alternatively, you can construct the URL manually:
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

- **Unique identifier field:** userName
- **Supported provisioning actions:**
  - Import New Users and Profile Updates
  - Push New Users
  - Push Profile Updates
- **Authentication Mode:** HTTP Header
- **Authorization:** Bearer {your-grafana-service-account-token}
- Click **Test Connector Configuration** and then save the configuration

In the **To App** tab, enable:

- Create Users
- Update User Attributes
- Deactivate Users

After completing the configuration:

1. Test the SCIM connector in Okta
2. Assign a test user to the application
3. Verify the user is provisioned in Grafana
