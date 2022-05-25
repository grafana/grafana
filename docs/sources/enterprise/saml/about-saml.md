---
aliases:
  - /docs/grafana/latest/auth/saml/
  - /docs/grafana/latest/enterprise/saml/about-saml/
description: SAML authentication
keywords:
  - grafana
  - saml
  - documentation
  - saml-auth
  - enterprise
menuTitle: About SAML authentication
title: About SAML authentication in Grafana
weight: 20
---

# About SAML authentication

SAML authentication integration allows your Grafana users to log in by using an external SAML 2.0 Identity Provider (IdP). To enable this, Grafana becomes a Service Provider (SP) in the authentication flow, interacting with the IdP to exchange user information.

The SAML single sign-on (SSO) standard is varied and flexible. Our implementation contains a subset of features needed to provide a smooth authentication experience into Grafana.

> Only available in Grafana Enterprise v6.3+. If you encounter any problems with our implementation, please don't hesitate to contact us.

## Supported SAML

Grafana supports the following SAML 2.0 bindings:

- From the Service Provider (SP) to the Identity Provider (IdP):

  - `HTTP-POST` binding
  - `HTTP-Redirect` binding

- From the Identity Provider (IdP) to the Service Provider (SP):
  - `HTTP-POST` binding

In terms of security:

- Grafana supports signed and encrypted assertions.
- Grafana does not support signed or encrypted requests.

In terms of initiation, Grafana supports:

- SP-initiated requests
- IdP-initiated requests

By default, SP-initiated requests are enabled. For instructions on how to enable IdP-initiated logins, see https://grafana.com/docs/grafana/latest/enterprise/saml/#idp-initiated-single-sign-on-sso.

### Edit SAML options in the Grafana config file

Once you have enabled saml, you can configure Grafana to use it for SAML authentication. Refer to [Configuration]({{< relref "../../administration/configuration.md" >}}) to get more information about how to configure Grafana.

**Edit SAML options in Grafana config file:**

1. In the `[auth.saml]` section in the Grafana configuration file, set [`enabled`]({{< relref ".././enterprise-configuration.md#enabled" >}}) to `true`.
1. Configure the [certificate and private key]({{< relref "#certificate-and-private-key" >}}).
1. On the Okta application page where you have been redirected after application created, navigate to the **Sign On** tab and find **Identity Provider metadata** link in the **Settings** section.
1. Set the [`idp_metadata_url`]({{< relref ".././enterprise-configuration.md#idp-metadata-url" >}}) to the URL obtained from the previous step. The URL should look like `https://<your-org-id>.okta.com/app/<application-id>/sso/saml/metadata`.
1. Set the following options to the attribute names configured at the **step 10** of the SAML integration setup. You can find this attributes on the **General** tab of the application page (**ATTRIBUTE STATEMENTS** and **GROUP ATTRIBUTE STATEMENTS** in the **SAML Settings** section).
   - [`assertion_attribute_login`]({{< relref ".././enterprise-configuration.md#assertion-attribute-login" >}})
   - [`assertion_attribute_email`]({{< relref ".././enterprise-configuration.md#assertion-attribute-email" >}})
   - [`assertion_attribute_name`]({{< relref ".././enterprise-configuration.md#assertion-attribute-name" >}})
   - [`assertion_attribute_groups`]({{< relref ".././enterprise-configuration.md#assertion-attribute-groups" >}})
1. Save the configuration file and and then restart the Grafana server.

When you are finished, the Grafana configuration might look like this example:

```bash
[server]
root_url = https://grafana.example.com

[auth.saml]
enabled = true
private_key_path = "/path/to/private_key.pem"
certificate_path = "/path/to/certificate.cert"
idp_metadata_url = "https://my-org.okta.com/app/my-application/sso/saml/metadata"
assertion_attribute_name = DisplayName
assertion_attribute_login = Login
assertion_attribute_email = Email
assertion_attribute_groups = Group
```
