---
aliases:
  - ../setup-grafana/configure-security/configure-authentication/saml/configure-saml-org-mapping/configure-saml-with-okta/oin-application/
description: Learn how to configure SAML authentication with Okta using the Okta Integration Network (OIN) application.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SAML with Okta catalog application
title: Configure SAML with Okta catalog application
weight: 590
---

# Configure SAML with Okta catalog application

Grafana offers multiple ways to configure the SAML authentication flow. This guide focuses on configuring the authentication flow using the Okta Integration Network (OIN) application.

The Grafana Labs application can be found in the [Okta Integration Network catalog](https://www.okta.com/integrations/).

## Prerequisites

- Grafana Enterprise or a paid Grafana Cloud account.
- Admin privileges in both Grafana and Okta.

## Supported features

- SAML Single Sign-On (SSO)
- SAML Attribute Mapping
- SAML Group Mapping
- SAML External ID Mapping for SCIM provisioning

## Configure SAML using the OIN application

### At the Okta Integration Network catalog

1. Visit the [Okta Integration Network catalog](https://www.okta.com/integrations/) and search for **Grafana Labs**.
1. Within the **Grafana Labs** application page, click on **+Add Integration**.
1. Select the tenant to add the integration to.

### At the Grafana Labs application page

1. If needed, update the **Application label**.
1. Set the domain name. For example, `your-grafana-domain.grafana.net`.
1. Click on **Done**.

| Field                 | Description                              |
| --------------------- | ---------------------------------------- |
| **Application label** | The name of the application.             |
| **Domain name**       | The domain name of the Grafana instance. |

### At the Grafana Labs Integration page

1. At the **Assignments** tab, add the groups or users that should have access to the application.
1. At the **Sign On** tab, copy the _Metadata URL_.

## Update SAML configuration at Grafana

### At the Grafana Labs SAML settings page

1. Navigate to the **SAML settings** page within the **Authentication** section from the left-hand menu.
1. The only required step is pasting the _Metadata URL_ in the **IdP Metadata URL** field, located at the **3. Connect Grafana with Identity Provider** tab.
1. Save and apply the changes.

With this configuration, the users will be able to access Grafana using their Okta credentials.
