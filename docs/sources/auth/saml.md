---
aliases:
  - /docs/grafana/latest/auth/saml/
description: Grafana SAML Authentication
keywords:
  - grafana
  - saml
  - documentation
  - saml-auth
title: SAML Authentication
weight: 1100
---

# SAML authentication

The SAML authentication integration allows your Grafana users to log in by using an external SAML Identity Provider (IdP). To enable this, Grafana becomes a Service Provider (SP) in the authentication flow, interacting with the IdP to exchange user information.

> SAML authentication integration is available in Grafana Cloud Pro and Advanced and in Grafana Enterprise. For more information, refer to [SAML authentication]({{< relref "../enterprise/saml.md" >}}) in [Grafana Enterprise]({{< relref "../enterprise" >}}).
