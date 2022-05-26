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

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise" >}}) and [Grafana Cloud Pro and Advanced]({{< relref "/grafana-cloud" >}}).

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

By default, SP-initiated requests are enabled. For instructions on how to enable IdP-initiated logins, refer to [IdP-initiated]({{< relref "./configure-saml/#idp-initiated-single-sign-on-sso" >}}) to get more information.

### Edit SAML options in the Grafana config file

Once you have enabled saml, you can configure Grafana to use it for SAML authentication. Refer to [Configure SAML Authentication]({{< relref "./configure-saml.md#" >}}) to get more information about how to configure Grafana.
