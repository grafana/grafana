---
aliases:
  - /docs/grafana/latest/auth/saml/
  - /docs/grafana/latest/enterprise/saml/
description: Grafana SAML authentication
keywords:
  - grafana
  - saml
  - documentation
  - saml-auth
  - enterprise
title: SAML authentication
weight: 10
---

# SAML authentication

SAML authentication integration enables your Grafana users to log in by using an external SAML 2.0 Identity Provider (IdP). To enable this, Grafana becomes a Service Provider (SP) in the authentication flow, interacting with the IdP to exchange user information.

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise" >}}) and [Grafana Cloud Pro and Advanced]({{< relref "/grafana-cloud" >}}).

{{< section >}}
