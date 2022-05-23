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

> Only available in Grafana Enterprise v6.3+. If you experience any issues with our implementation, contact our [Technical Support team](https://grafana.com/contact?plcmt=top-nav&cta=contactus)

{{< section >}}
