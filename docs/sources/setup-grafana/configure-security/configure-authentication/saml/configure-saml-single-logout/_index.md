---
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SAML single logout
title: Configure SAML single logout
weight: 560
---

### Single logout

SAML's single logout feature allows users to log out from all applications associated with the current IdP session established via SAML SSO. If the `single_logout` option is set to `true` and a user logs out, Grafana requests IdP to end the user session which in turn triggers logout from all other applications the user is logged into using the same IdP session (applications should support single logout). Conversely, if another application connected to the same IdP logs out using single logout, Grafana receives a logout request from IdP and ends the user session.

`HTTP-Redirect` and `HTTP-POST` bindings are supported for single logout.
When using `HTTP-Redirect` bindings the query should include a request signature.

#### Configure single logout

To configure single logout in Grafana:

1. Enable the `single_logout` option in your configuration.
2. Ensure the `name_id_format` matches the format your IdP expects (e.g., `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`).
3. Enable the `improvedExternalSessionHandlingSAML` feature toggle for complete NameID and SessionIndex support (Grafana v11.5+).
4. After enabling the feature, users may need to log in again to establish a new session.

#### `NameID` and `SessionIndex` changes in Grafana v11.5

Before Grafana version 11.5, the `Login` attribute value (extracted from the SAML assertion using the `assertion_attribute_login` configuration) was used as the `NameID` in the logout request. This could cause issues with single logout if the `assertion_attribute_login` value differed from what the Identity Provider (IdP) expected.

Additionally, Grafana did not support IdP sessions and could not include the `SessionIndex` (a unique identifier for the user session on the IdP side) value in the logout request. This could result in issues such as the user being logged out from all of their applications/IdP sessions when logging out from Grafana.

Starting from Grafana version 11.5, Grafana uses the `NameID` from the SAML assertion to create the logout request. If the `NameID` is not present in the assertion, Grafana defaults to using the user's `Login` attribute. Additionally, Grafana supports including the `SessionIndex` in the logout request if it is provided in the SAML assertion by the IdP.

{{% admonition type="note" %}}
These improvements are available in public preview behind the `improvedExternalSessionHandlingSAML` feature toggle, starting from Grafana v11.5. To enable it, refer to the [Configure feature toggles](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/)
{{% /admonition %}}
