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
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud Advanced](/docs/grafana-cloud/).
{{< /admonition >}}

This guide explains how to configure SCIM provisioning with Okta to automate user and team management in Grafana.

{{< admonition type="note" >}}
This feature is behind the `enableSCIM` feature toggle.
You can enable feature toggles through configuration file or environment variables.

For more information, refer to the [feature toggles documentation](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles).
{{< /admonition >}}

## Prerequisites

Before configuring SCIM with Okta, ensure you have:

- Grafana Enterprise or Grafana Cloud Advanced
- Admin access to both Grafana and Okta
- [SAML authentication configured with Okta](../../configure-authentication/saml/#set-up-saml-with-okta)
- SCIM feature enabled in Grafana

## Configure SCIM in Grafana

To enable SCIM provisioning in Grafana, create a service account and generate an access token that will be used to authenticate SCIM requests from Okta.

### Create a service account

1. Navigate to **Administration > User Access > Service accounts**
2. Click **Add new service account**
3. Create a new access token and save it securely
   - This token will be used in the Okta configuration

## Configure SCIM in Okta

Configure both SAML authentication and SCIM provisioning in Okta to enable automated user and team synchronization with Grafana. Start by creating a SAML application, then enable and configure SCIM provisioning for that application.

### Enable SCIM provisioning

1. Navigate to the **General** tab of your SAML App Integration in Okta
2. Enable SCIM provisioning
   - A new provisioning tab will appear

### Configure provisioning settings

In the **To App** tab, enable:

- Create Users
- Update User Attributes
- Deactivate Users

### Configure SCIM integration

In the **Integration** tab, configure:

- **SCIM Connector base URL:**
  ```
  https://{resource_name}/apis/scim.grafana.app/v0alpha1/namespaces/stacks-{stack-id}
  ```
- **Unique identifier field:** userName
- **Supported provisioning actions:**
  - Import New Users and Profile Updates
  - Push New Users
  - Push Profile Updates

## Test the integration

After completing the configuration:

1. Test the SCIM connector in Okta
2. Assign a test user to the application
3. Verify the user is provisioned in Grafana

## Troubleshooting

For common issues and solutions when working with SCIM provisioning, refer to the [SCIM troubleshooting guide](../troubleshooting/).
