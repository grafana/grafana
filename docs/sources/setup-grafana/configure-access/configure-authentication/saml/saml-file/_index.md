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
menuTitle: SAML config file
title: Configure SAML authentication using the Grafana configuration file
weight: 505
---

# Configure SAML authentication using the Grafana configuration file

{{< admonition type="note" >}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud).

Refer to [Configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/) for more information about configuring Grafana.
{{< /admonition >}}

To configure SAML authentication in Grafana using the configuration file, follow these steps:

1. In the `[auth.saml]` section in the Grafana configuration file, set [`enabled`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#enabled-3) to `true`.
2. Configure SAML according to your requirements. **Review all the [available configuration options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/saml-configuration-options/)**.
3. For IdP-specific configuration, refer to:
   - [Configure SAML with Okta](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-with-okta/)
   - [Configure SAML with Entra ID](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml/configure-saml-with-azuread/)
4. Save the configuration file and then restart the Grafana server.

Here's an example of a Grafana configuration file with SAML:

```ini
[server]
root_url = https://grafana.example.com

[auth.saml]
enabled = true
name = My IdP
auto_login = false
private_key_path = "/path/to/private_key.pem"
certificate_path = "/path/to/certificate.cert"
idp_metadata_url = "https://my-org.okta.com/app/my-application/sso/saml/metadata"
assertion_attribute_name = DisplayName
assertion_attribute_login = Login
assertion_attribute_email = Email
assertion_attribute_groups = Group
```

## SAML Name ID

The `name_id_format` configuration field specifies the requested format of the NameID element in the SAML assertion.

By default, this is set to `urn:oasis:names:tc:SAML:2.0:nameid-format:transient` and does not need to be specified in the configuration file.

The following list includes valid configuration field values:

| `name_id_format` value in the configuration file or Terraform | `Name identifier format` on the UI |
| ------------------------------------------------------------- | ---------------------------------- |
| `urn:oasis:names:tc:SAML:2.0:nameid-format:transient`         | Default                            |
| `urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified`       | Unspecified                        |
| `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`      | Email address                      |
| `urn:oasis:names:tc:SAML:2.0:nameid-format:persistent`        | Persistent                         |
| `urn:oasis:names:tc:SAML:2.0:nameid-format:transient`         | Transient                          |

## Maximum issue delay

Prevents SAML response replay attacks and internal clock skews between the SP (Grafana) and the IdP. You can set a maximum amount of time between the SP issuing the AuthnRequest and the SP (Grafana) processing it.

The configuration options is specified as a duration, such as `max_issue_delay = 90s` or `max_issue_delay = 1h`.

## Metadata valid duration

SP metadata is likely to expire at some point, perhaps due to a certificate rotation or change of location binding. Grafana allows you to specify for how long the metadata should be valid. Leveraging the `validUntil` field, you can tell consumers until when your metadata is going to be valid. The duration is computed by adding the duration to the current time.

The configuration option is specified as a duration, such as `metadata_valid_duration = 48h`.

## Allow new user sign up

By default, new Grafana users using SAML authentication will have an account created for them automatically. To decouple authentication and account creation and ensure only users with existing accounts can log in with SAML, set the `allow_sign_up` option to false.

## Configure automatic login

Set `auto_login` option to true to attempt login automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.

For more information about automatic login behavior and troubleshooting, see [Automatic login](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/#automatic-oauth-login).

```
auto_login = true
```

## Configure allowed organizations

With the [`allowed_organizations`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#allowed_organizations) option you can specify a list of organizations where the user must be a member of at least one of them to be able to log in to Grafana.

To get the list of user's organizations from SAML attributes, you must configure the `assertion_attribute_org` option. This option specifies which SAML attribute contains the list of organizations the user belongs to.

To put values containing spaces in the list, use the following JSON syntax:

```ini
allowed_organizations = ["org 1", "second org"]
```

## Configuring SAML with HTTP-Post binding

If multiple bindings are supported for SAML Single Sign-On (SSO) by the Identity Provider (IdP), Grafana will use the `HTTP-Redirect` binding by default. If the IdP only supports the `HTTP-Post binding` then updating the `content_security_policy_template` (in case `content_security_policy = true`) and `content_security_policy_report_only_template` (in case `content_security_policy_report_only = true`) might be required to allow Grafana to initiate a POST request to the IdP. These settings are used to define the [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) headers that are sent by Grafana.

To allow Grafana to initiate a POST request to the IdP, update the `content_security_policy_template` and `content_security_policy_report_only_template` settings in the Grafana configuration file and add the identity provider domain to the `form-action` directive. By default, the `form-action` directive is set to `self` which only allows POST requests to the same domain as Grafana. To allow POST requests to the identity provider domain, update the `form-action` directive to include the identity provider domain, for example: `form-action 'self' https://idp.example.com`.

{{< admonition type="note" >}}
For Grafana Cloud instances, please contact Grafana Support to update the `content_security_policy_template` and `content_security_policy_report_only_template` settings of your Grafana instance. Please provide the metadata URL/file of your IdP.
{{< /admonition >}}

## IdP-initiated Single Sign-On (SSO)

By default, Grafana allows only service provider (SP) initiated logins (when the user logs in with SAML via the login page in Grafana). If you want users to log in into Grafana directly from your identity provider (IdP), set the `allow_idp_initiated` configuration option to `true` and configure `relay_state` with the same value specified in the IdP configuration.

IdP-initiated SSO has some security risks, so make sure you understand the risks before enabling this feature. When using IdP-initiated login, Grafana receives unsolicited SAML responses and can't verify that login flow was started by the user. This makes it hard to detect whether SAML message has been stolen or replaced. Because of this, IdP-initiated login is vulnerable to login cross-site request forgery (CSRF) and man in the middle (MITM) attacks. We do not recommend using IdP-initiated login and keeping it disabled whenever possible.

## Assertion mapping

`assertion_attribute_name` is a special assertion mapping that can either be a simple key, indicating a mapping to a single assertion attribute on the SAML response, or a complex template with variables using the `$__saml{<attribute>}` syntax. If this property is misconfigured, Grafana will log an error message on startup and disallow SAML sign-ins. Grafana will also log errors after a login attempt if a variable in the template is missing from the SAML response.

Refer to [Assertion mapping](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/saml#assertion-mapping) for more information.

Examples:

```ini
#plain string mapping
assertion_attribute_name = displayName
```

```ini
#template mapping
assertion_attribute_name = $__saml{firstName} $__saml{lastName}
```
