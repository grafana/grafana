---
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SAML with Entra ID
title: Configure SAML authentication with Entra ID
weight: 570
---

# Configure SAML with Microsoft Entra ID

Grafana supports user authentication through Microsoft Entra ID. This topic shows you how to configure SAML authentication in Grafana with [Entra ID](https://www.microsoft.com/en-us/security/business/identity-access/microsoft-entra-id).

{{< admonition type="note" >}}
If an Entra ID user belongs to more than 150 groups, a Graph API endpoint is used instead.

Grafana versions 11.1 and below, do not support fetching the groups from the Graph API endpoint. As a result, users with more than 150 groups will not be able to retrieve their groups. Instead, it is recommended that you use the Azure AD connector.

As of Grafana 11.2, the SAML integration offers a mechanism to retrieve user groups from the Graph API.

Related links:

- [Entra ID SAML limitations](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#groups-overage-claim)
- [Configure a Graph API application in Entra ID](#configure-a-graph-api-application-in-entra-id)
  {{< /admonition >}}

## Before you begin

Ensure you have permission to administer SAML authentication. For more information about roles and permissions in Grafana, refer to [Roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).

If you have users that belong to more than 150 groups, configure a registered application to provide an Entra ID Graph API to retrieve the groups. Refer to [Setup Entra ID Graph API applications](#configure-a-graph-api-application-in-entra-id).

## Generate self-signed certificates

Entra ID requires a certificate to verify the SAML requests' signature. You can generate a private key and a self-signed certificate using the following command (the private key used to sign the requests and the certificate contains the public key for verification):

```sh
$ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

This will generate a `key.pem` and `cert.pem` file that you can use for the `private_key_path` and `certificate_path` configuration options.

## Add Microsoft Entra SAML Toolkit from the gallery

> Taken from https://learn.microsoft.com/en-us/entra/identity/saas-apps/saml-toolkit-tutorial#add-microsoft-entra-saml-toolkit-from-the-gallery

1. Go to the [Azure portal](https://portal.azure.com/#home) and sign in with your Entra ID account.
1. Search for **Enterprise Applications**.
1. In the **Enterprise applications** pane, select **New application**.
1. In the search box, enter **SAML Toolkit**, and then select the **Microsoft Entra SAML Toolkit** from the results panel.
1. Add a descriptive name and select **Create**.

## Configure the SAML Toolkit application endpoints

In order to validate Entra ID users with Grafana, you need to configure the SAML Toolkit application endpoints by creating a new SAML integration in the Entra ID organization.

> For the following configuration, we will use `https://localhost` as the Grafana URL. Replace it with your Grafana URL.

1. In the **SAML Toolkit application**, select **Set up single sign-on**.
1. In the **Single sign-on** pane, select **SAML**.
1. In the Set up **Single Sign-On with SAML** pane, select the pencil icon for **Basic SAML Configuration** to edit the settings.
1. In the **Basic SAML Configuration** pane, click on the **Edit** button and update the following fields:
   - In the **Identifier (Entity ID)** field, enter `https://localhost/saml/metadata`.
   - In the **Reply URL (Assertion Consumer Service URL)** field, enter `https://localhost/saml/acs`.
   - In the **Sign on URL** field, enter `https://localhost`.
   - In the **Relay State** field, enter `https://localhost`.
   - In the **Logout URL** field, enter `https://localhost/saml/slo`.
1. Select **Save**.
1. At the **SAML Certificate** section, copy the **App Federation Metadata Url**.
   - Use this URL in the `idp_metadata_url` field in the `custom.ini` file.

### Generate a client secret

1. In the **Overview** pane, select **Certificates & secrets**.
1. Select **New client secret**.
1. In the **Add a client secret** pane, enter a description for the secret.
1. Set the expiration date for the secret.
1. Select **Add**.
1. Copy the value of the secret. This value is used in the `client_secret` field in the [SAML configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/saml/saml-configuration-options/).

## Configure SAML assertions when using SCIM provisioning

In order to verify the logged in user is the same user that was provisioned through Azure AD, you need to include the same `externalId` in the SAML assertion by mapping the SAML assertion `assertion_attribute_external_id`.

1. Open your Entra ID application.
1. Select the SAML single sign-on configuration.
1. Edit the `Attributes & Claims` section.
1. Add a new claim with the following settings:
   - Name: `userUID`
   - Namespace: leave blank
   - Source: Attribute
   - Source attribute: `user.objectId`
1. **Save** the current configuration.

## Configure a Graph API application in Entra ID

While an Entra ID tenant can be configured in Grafana via SAML, some additional information is only accessible via the Graph API. To retrieve this information, create a new application in Entra ID and grant it the necessary permissions.

> [Entra ID SAML limitations](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#groups-overage-claim)

> For the following configuration, the URL `https://localhost` will be used as the Grafana URL. Replace it with your Grafana instance URL.

### Create a new App registration

This app registration will be used as a Service Account to retrieve more information about the user from the Entra ID.

1. Go to the [Azure portal](https://portal.azure.com/#home) and sign in with your Entra ID account.
1. In the left-hand navigation pane, select the Microsoft Entra ID service, and then select **App registrations**.
1. Click the **New registration** button.
1. In the **Register an application** pane, enter a name for the application.
1. In the **Supported account types** section, select the account types that can use the application.
1. In the **Redirect URI** section, select Web and enter `https://localhost/login/azuread`.
1. Click the **Register** button.

### Set up permissions for the application

1. In the overview pane, look for **API permissions** section and select **Add a permission**.
1. In the **Request API permissions** pane, select **Microsoft Graph**, and click **Application permissions**.
1. In the **Select permissions** pane, under the **GroupMember** section, select **GroupMember.Read.All**.
1. In the **Select permissions** pane, under the **User** section, select **User.Read.All**.
1. Click the **Add permissions** button at the bottom of the page.
1. In the **Request API permissions** pane, select **Microsoft Graph**, and click **Delegated permissions**.
1. In the **Select permissions** pane, under the **User** section, select **User.Read**.
1. Click the **Add permissions** button at the bottom of the page.
1. In the **API permissions** section, select **Grant admin consent for `<directory-name>`**.

The following table shows what the permissions look like from the Entra ID portal:

| Permissions name       | Type        | Admin consent required | Status  |
| ---------------------- | ----------- | ---------------------- | ------- |
| `GroupMember.Read.All` | Application | Yes                    | Granted |
| `User.Read`            | Delegated   | No                     | Granted |
| `User.Read.All`        | Application | Yes                    | Granted |

{{< figure src="/media/docs/IAM/image.png" caption="Screen shot of the permissions listed in Entra ID for the App registration" >}}

To test that Graph API has the correct permissions, refer to the [Troubleshoot Graph API calls](../troubleshoot-saml/#troubleshoot-graph-api-calls) section.
