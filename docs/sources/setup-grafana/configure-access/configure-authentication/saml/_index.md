---
aliases:
  - ../../../auth/saml/ # /docs/grafana/latest/auth/saml/
  - ../../../enterprise/configure-saml/ # /docs/grafana/latest/enterprise/configure-saml/
  - ../../../enterprise/saml/ # /docs/grafana/latest/enterprise/saml/
  - ../../../enterprise/saml/about-saml/ # /docs/grafana/latest/enterprise/saml/about-saml/
  - ../../../enterprise/saml/configure-saml/ # /docs/grafana/latest/enterprise/saml/configure-saml/
  - ../../../enterprise/saml/enable-saml/ # /docs/grafana/latest/enterprise/saml/enable-saml/
  - ../../../enterprise/saml/set-up-saml-with-okta/ # /docs/grafana/latest/enterprise/saml/set-up-saml-with-okta/
  - ../../../enterprise/saml/troubleshoot-saml/ # /docs/grafana/latest/enterprise/saml/troubleshoot-saml/
  - ../../configure-security/setup-grafana/configure-security/configure-authentication/saml/ # /docs/grafana/next/setup-grafana/configure-security/setup-grafana/configure-security/configure-authentication/saml/
  - ../../configure-security/configure-authentication/saml/ # /docs/grafana/next/setup-grafana/configure-security/configure-authentication/saml/
description: Learn how to configure SAML authentication in Grafana's configuration file.
labels:
  products:
    - cloud
    - enterprise
menuTitle: SAML
title: Configure SAML authentication in Grafana
weight: 500
---

# SAML authentication in Grafana

{{< admonition type="note" >}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

SAML authentication integration allows your Grafana users to log in by using an external SAML 2.0 Identity Provider (IdP). To enable this, Grafana becomes a Service Provider (SP) in the authentication flow, interacting with the IdP to exchange user information.

You can configure SAML authentication in Grafana through one of the following methods:

- Configure SAML using the [Grafana configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/saml-file/)
- Configure SAML using the [SAML user interface](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/saml-ui/)
- Configure SAML using the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/<GRAFANA_VERSION>/docs/resources/sso_settings)
- Configure SAML using the [SSO Settings API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/sso-settings/)

If you're using Okta or Entra ID as Identity Provider, see the following documentation for configuration:

- [Configure SAML with Entra ID](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-with-azuread/)
- [Configure SAML with Okta](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-with-okta/)
- [Configure SAML with Okta catalog application](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-with-okta/oin-application)

All methods offer the same configuration options. However, if you want to keep all of Grafana authentication settings in one place, use the Grafana configuration file or the Terraform provider. If you are a Grafana Cloud user, you do not have access to Grafana configuration file. Instead, configure SAML through the other methods.

{{< admonition type="note" >}}
Configuration in the API takes precedence over the configuration in the Grafana configuration file. SAML settings from the API will override any SAML configuration set in the Grafana configuration file.
{{< /admonition >}}

## SAML Bindings

Grafana supports the following SAML 2.0 bindings:

- From the Service Provider (SP) to the Identity Provider (IdP):
  - `HTTP-POST` binding
  - `HTTP-Redirect` binding

- From the Identity Provider (IdP) to the Service Provider (SP):
  - `HTTP-POST` binding

## Request Initiation

Grafana supports:

- SP-initiated requests
- IdP-initiated requests

By default, SP-initiated requests are enabled. For instructions on how to enable IdP-initiated logins, see [IdP-initiated Single Sign-On (SSO)](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/saml-file#idp-initiated-single-sign-on-sso).

## Enable SAML authentication in Grafana

To use the SAML integration, in the `auth.saml` section of in the Grafana custom configuration file, set `enabled` to `true`.

Refer to [Configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/) for more information about configuring Grafana.

## Identity provider (IdP) registration

For the SAML integration to work correctly, you need to make the IdP aware of the SP.

The integration provides two key endpoints as part of Grafana:

- The `/saml/metadata` endpoint, which contains the SP metadata. You can either download and upload it manually, or you make the IdP request it directly from the endpoint. Some providers name it Identifier or Entity ID.
- The `/saml/acs` endpoint, which is intended to receive the ACS (Assertion Customer Service) callback. Some providers name it SSO URL or Reply URL.

## Integrating with SCIM Provisioning

If you are also using SCIM provisioning for this Grafana application in Entra ID, it's crucial to align the user identifiers between SAML and SCIM for seamless operation. The unique identifier that links the SAML user to the SCIM provisioned user is determined by the `assertion_attribute_external_uid` setting in the Grafana SAML configuration. This `assertion_attribute_external_uid` should correspond to the `externalId` used in SCIM provisioning (typically set to the Entra ID `user.objectid`).

1.  **Ensure Consistent Identifier in SAML Assertion:**
    - The unique identifier from Entra ID (typically `user.objectid`) that you mapped to the `externalId` attribute in Grafana in your SCIM provisioning setup **must also be sent as a claim in the SAML assertion.** For more details on SCIM, refer to the [SCIM provisioning documentation](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/).
    - In the Entra ID Enterprise Application, under **Single sign-on** > **Attributes & Claims**, ensure you add a claim that provides this identifier. For example, you might add a claim named `UserID` (or similar, like `externalId`) that sources its value from `user.objectid`.

2.  **Configure Grafana SAML Settings for SCIM:**
    - In the `[auth.saml]` section of your Grafana configuration, set `assertion_attribute_external_uid` to the name of the SAML claim you configured in the previous step (e.g., `userUID` or the full URI like `http://schemas.microsoft.com/identity/claims/objectidentifier` if that's how Entra ID sends it).
    - The `assertion_attribute_login` setting should still be configured to map to the attribute your users will log in with (e.g., `userPrincipalName`, `mail`).

    _Example Grafana Configuration:_

    ```ini
    [auth.saml]
    # ... other SAML settings ...
    assertion_attribute_login = http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier # Or other login attribute
    assertion_attribute_external_uid = http://schemas.microsoft.com/identity/claims/objectidentifier # Or your custom claim name for user.objectid
    ```

    Ensure that the value specified in `assertion_attribute_external_uid` precisely matches the name of the claim as it's sent in the SAML assertion from Entra ID.

3.  **SCIM Linking Identifier and Entra ID:**
    - By default (if `assertion_attribute_external_uid` is not set), Grafana uses the `userUID` attribute from the SAML assertion for SCIM linking.
    - **Recommended for Entra ID:** For SCIM integration with Entra ID, it is necessary to:
      1.  Ensure Entra ID sends the `user.objectid` in a claim.
      2.  Either set this claim name in Entra ID to `userUID`, or, if you want to use a different claim name, set `assertion_attribute_external_uid` in Grafana to match the claim name you chose in Entra ID.

## Advanced configuration

For advanced configuration and troubleshooting, refer to the one of the following pages:

- [Configure SAML request signing](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-signing-encryption/)
- [Configure SAML single logout](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-single-logout/)
- [Configure Organization mapping](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-org-mapping/)
- [Configure Role and Team sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-team-role-mapping/)
- [SAML configuration options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/saml-configuration-options/)
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/troubleshoot-saml/)
