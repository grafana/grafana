---
aliases:
  - ../../../configure-security/configure-authentication/saml-ui/ # /docs/grafana/next/setup-grafana/configure-security/configure-authentication/saml-ui/
  - ../saml-ui/ # /docs/grafana/latest/setup-grafana/configure-access/configure-authentication/saml-ui/
  - ../../../configure-security/configure-authentication/setup-grafana/configure-security/configure-authentication/saml/saml-ui/ # /docs/grafana/next/setup-grafana/configure-security/configure-authentication/setup-grafana/configure-security/configure-authentication/saml/saml-ui/
  - ../../../configure-security/configure-authentication/saml/saml-ui/ # /docs/grafana/next/setup-grafana/configure-security/configure-authentication/saml/saml-ui/
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: SAML user interface
title: Configure SAML authentication using the Grafana user interface
weight: 510
---

# Configure SAML authentication using the Grafana user interface

{{< admonition type="note" >}}
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) version 10.0 and later, and to customers on select Grafana Cloud plans. For pricing information, visit [Pricing](https://grafana.com/pricing/) or contact our sales team.
{{< /admonition >}}

You can configure SAML authentication in Grafana using the configuration file, Terraform, the API, or the UI. Refer to [Set up options for SAML authentication in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml#set-up-options-for-saml-authentication-in-grafana) for more details. Configuration in the API or UI takes precedence over the configuration in the Grafana configuration file. For more information on how Grafana determines the order of precedence for its settings, refer to the [SSO Settings API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/sso-settings/).

The Grafana SAML UI provides the following advantages over configuring SAML in the Grafana configuration file:

- It's accessible by Grafana Cloud users.
- Access to the SAML UI only requires access to authentication settings, so users with limited access to the Grafana configuration can use it.
- The SAML UI carries out input validation and gives feedback on whether the configuration works, making SAML setup easier.
- It doesn't require Grafana to be restarted after a configuration update.

To configure SAML authentication from the UI, sign in to Grafana and navigate to **Administration > Authentication > Configure SAML** and follow this document.

## Before you begin

To follow this guide, you need:

- Knowledge of SAML authentication. Refer to [SAML authentication in Grafana](../) for an overview of the SAML integration in Grafana.
- Permissions `settings:read` and `settings:write` with scope `settings:auth.saml:*` that allow you to read and update SAML authentication settings, which are granted by `fixed:authentication.config:writer` role. By default, this role is granted to Grafana server administrator in self-hosted instances and to Organization admins in Grafana Cloud instances.
- A Grafana instance running Grafana version 10.0 or later with [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/), or a select Grafana Cloud account.

## General Settings

Complete the **General settings** fields:

- **Allow signup:** If enabled, you can create users through SAML login. If it's disabled, only existing Grafana users can log in with SAML.
- **Auto login:** If enabled, Grafana automatically logs in with SAML, skipping the login screen.
- **Single logout:** The SAML single logout feature enables users to log out from all applications associated with the current IdP session established using SAML SSO. For more information, refer to [SAML single logout documentation](../configure-saml-single-logout).
- **Identity provider initiated login:** Enables users to log in to Grafana directly from the SAML IdP. For more information, refer to [IdP initiated login documentation](../#idp-initiated-single-sign-on-sso).

## Sign Requests

Toggle **Sign requests** to specify whether you want the outgoing requests to be signed. Although optional, requesting signatures provides a more secure approach to SAML.

If you select to sign them:

- Provide a certificate and a private key that'll be used by the service provider (Grafana) and the SAML IdP.

  Use the [PKCS #8](https://en.wikipedia.org/wiki/PKCS_8) format to issue the private key.

  For more information, refer to an [example on how to generate SAML credentials](../configure-saml-signing-encryption/#example-of-private-key-generation-for-saml-authentication).

  Alternatively, you can generate a new private key and certificate pair directly from the UI. Click the `Generate key and certificate` button to open a form where you provide information to embed in the new certificate.

- Choose which signature algorithm to use. The SAML standard recommends using a digital signature for some types of messages, like authentication or logout requests to avoid [man-in-the-middle attacks](https://en.wikipedia.org/wiki/Man-in-the-middle_attack).

## Connect Grafana with the Identity Provider

{{< admonition type="note" >}}
You can skip this screen.
{{< /admonition >}}

Configure IdP using Grafana metadata:

- Copy the **Metadata URL** and provide it to your SAML IdP to establish a connection between Grafana and the IdP. The metadata URL contains the necessary information for the IdP to establish a connection with Grafana.
- Copy the **Assertion Consumer Service URL** and provide it to your SAML IdP. The Assertion Consumer Service URL is the endpoint where the IdP sends the SAML assertion after the user has been authenticated.
- If you want to use the **Single Logout** feature, copy the **Single Logout Service URL** and provide it to your SAML IdP.

Finish configuring Grafana using IdP data:

- The metadata contains the necessary information for Grafana to establish a connection with the IdP.
- This can be provided as Base64-encoded value, a path to a file, or as a URL.

## User Mapping

### Assertion mapping

If you want to [map user information from SAML assertions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml#assertion-mapping), complete the **Assertion attributes mappings** section.

- To use team sync you need to configure the **Groups attribute** field. Team sync automatically maps users to Grafana teams based on their SAML group membership. Learn more about [team sync](../../../configure-team-sync) and [configuring team sync for SAML](../configure-saml-team-role-mapping/#configure-team-sync).

### Role mapping

If you want to automatically assign users' roles based on their SAML roles, complete the **Role mapping** section.

First, you need to configure the **Role attribute** field to specify which SAML attribute should be used to retrieve SAML role information. Then enter the SAML roles that you want to map to Grafana roles in **Role mapping** section. If you want to map multiple SAML roles to a Grafana role, separate them by a comma and a space. For example, `Editor: editor, developer`.

Role mapping automatically updates user's [basic role](../../../../../administration/roles-and-permissions/access-control/#basic-roles) based on their SAML roles every time the user logs in to Grafana. Learn more about [SAML role synchronization](../configure-saml-team-role-mapping/#configure-role-sync).

### Mapping with Entra ID

If you're using Entra ID as the Identity Provider over SAML, keep in mind Azure's interpretation of these attributes. Enter the full URLs in the corresponding fields within the UI, which should match the URLs from the metadata XML. There are differences depending on whether it's a Role or Group claim vs other assertions which Microsoft has [documented](https://learn.microsoft.com/en-us/entra/identity-platform/reference-claims-customization#table-2-saml-restricted-claim-set).

Group and Role:

```
http://schemas.microsoft.com/ws/2008/06/identity/claims/role
http://schemas.microsoft.com/ws/2008/06/identity/claims/groups
http://schemas.microsoft.com/identity/claims/displayname
```

Other assertions:

```
http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
```

![image](https://github.com/user-attachments/assets/23910ab8-20ec-4dfd-8ef6-7dbaec51ac90)

If you're setting up Grafana with Entra ID using the SAML protocol and want to fetch user groups from the Graph API, complete the **Entra ID Service Account Configuration** subsection.

1. Set up a service account in Entra ID and provide the necessary details in the **Entra ID Service Account Configuration** section.
1. Provide the **Client ID** of your Entra ID application.
1. Provide the **Client Secret** of your Entra ID application, the **Client Secret** will be used to request an access token from Entra ID.
1. Provide the Entra ID request **Access Token URL**.
1. If you don't have users with more than 150 groups, you can still force the use of the Graph API by enabling the **Force use Graph API** toggle.

### Mapping organizations

If you have multiple organizations and want to automatically add users to organizations, complete the **Org mapping section**.

First, you need to configure the **Org attribute** field to specify which SAML attribute should be used to retrieve SAML organization information.
Now fill in the **Org mapping** field with mappings from SAML organization to Grafana organization. For example, `Org mapping: Engineering:2, Sales:2` will map users who belong to `Engineering` or `Sales` organizations in SAML to Grafana organization with ID 2.
If you want users to have different roles in different organizations, you can additionally specify a role. For example, `Org mapping: Engineering:2:Editor` will map users who belong to `Engineering` organizations in SAML to Grafana organization with ID 2 and assign them Editor role.

Organization mapping automatically updates user's organization memberships (and roles, if they've been configured) based on their SAML organization every time the user logs in to Grafana. Learn more about [SAML organization mapping](../configure-saml-org-mapping/).

If you want to limit the access to Grafana based on user's SAML organization membership, fill in the **Allowed organizations** field.

## Test And Enable

1. Click **Save and enable**. If there are issues with your configuration, an error message will appear. Refer back to the previous steps to correct the issues and click on `Save and apply` on the top right corner once you are done.
1. If there are no configuration issues, the SAML integration status will change to `Enabled`. Your SAML configuration is now enabled.
1. To disable SAML integration, click `Disable` in the top right corner.
