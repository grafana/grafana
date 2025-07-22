---
labels:
  products:
    - cloud
    - enterprise
menuTitle: SAML configuration options
title: SAML configuration options
weight: 520
---

# SAML configuration options

This page provides a comprehensive guide to configuring SAML authentication in Grafana. You'll find detailed configuration examples, available settings, and their descriptions to help you set up and customize SAML authentication for your Grafana instance.

The table below describes all SAML configuration options. Continue reading below for details on specific options. Like any other Grafana configuration, you can apply these options as [environment variables](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#override-configuration-with-environment-variables).

| Setting                                                    | Required | Description                                                                                                                                                                                                  | Default                                               |
| ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `enabled`                                                  | No       | Whether SAML authentication is allowed.                                                                                                                                                                      | `false`                                               |
| `name`                                                     | No       | Name used to refer to the SAML authentication in the Grafana user interface.                                                                                                                                 | `SAML`                                                |
| `entity_id`                                                | No       | The entity ID of the service provider. This is the unique identifier of the service provider.                                                                                                                | `https://{Grafana URL}/saml/metadata`                 |
| `single_logout`                                            | No       | Whether SAML Single Logout is enabled.                                                                                                                                                                       | `false`                                               |
| `allow_sign_up`                                            | No       | Whether to allow new Grafana user creation through SAML login. If set to `false`, then only existing Grafana users can log in with SAML.                                                                     | `true`                                                |
| `auto_login`                                               | No       | Whether SAML auto login is enabled.                                                                                                                                                                          | `false`                                               |
| `allow_idp_initiated`                                      | No       | Whether SAML IdP-initiated login is allowed.                                                                                                                                                                 | `false`                                               |
| `certificate` or `certificate_path`                        | Yes      | Base64-encoded string or Path for the SP X.509 certificate.                                                                                                                                                  |                                                       |
| `private_key` or `private_key_path`                        | Yes      | Base64-encoded string or Path for the SP private key.                                                                                                                                                        |                                                       |
| `signature_algorithm`                                      | No       | Signature algorithm used for signing requests to the IdP. Supported values are rsa-sha1, rsa-sha256, rsa-sha512.                                                                                             |                                                       |
| `idp_metadata`, `idp_metadata_path`, or `idp_metadata_url` | Yes      | Base64-encoded string, Path or URL for the IdP SAML metadata XML.                                                                                                                                            |                                                       |
| `max_issue_delay`                                          | No       | Maximum time allowed between the issuance of an AuthnRequest by the SP and the processing of the Response.                                                                                                   | `90s`                                                 |
| `metadata_valid_duration`                                  | No       | Duration for which the SP metadata remains valid.                                                                                                                                                            | `48h`                                                 |
| `relay_state`                                              | No       | Relay state for IdP-initiated login. This should match the relay state configured in the IdP.                                                                                                                |                                                       |
| `assertion_attribute_name`                                 | No       | Friendly name or name of the attribute within the SAML assertion to use as the user name. Alternatively, this can be a template with variables that match the names of attributes within the SAML assertion. | `displayName`                                         |
| `assertion_attribute_login`                                | No       | Friendly name or name of the attribute within the SAML assertion to use as the user login handle.                                                                                                            | `mail`                                                |
| `assertion_attribute_email`                                | No       | Friendly name or name of the attribute within the SAML assertion to use as the user email.                                                                                                                   | `mail`                                                |
| `assertion_attribute_groups`                               | No       | Friendly name or name of the attribute within the SAML assertion to use as the user groups.                                                                                                                  |                                                       |
| `assertion_attribute_role`                                 | No       | Friendly name or name of the attribute within the SAML assertion to use as the user roles.                                                                                                                   |                                                       |
| `assertion_attribute_org`                                  | No       | Friendly name or name of the attribute within the SAML assertion to use as the user organization                                                                                                             |                                                       |
| `assertion_attribute_external_uid`                         | No       | Friendly name or name of the attribute within the SAML assertion to use as the user external UID.                                                                                                            | `userUID`                                             |
| `allowed_organizations`                                    | No       | List of comma- or space-separated organizations. User should be a member of at least one organization to log in.                                                                                             |                                                       |
| `org_mapping`                                              | No       | List of comma- or space-separated Organization:OrgId:Role mappings. Organization can be `*` meaning "All users". Role is optional and can have the following values: `None`, `Viewer`, `Editor` or `Admin`.  |                                                       |
| `role_values_none`                                         | No       | List of comma- or space-separated roles which will be mapped into the None role.                                                                                                                             |                                                       |
| `role_values_viewer`                                       | No       | List of comma- or space-separated roles which will be mapped into the Viewer role.                                                                                                                           |                                                       |
| `role_values_editor`                                       | No       | List of comma- or space-separated roles which will be mapped into the Editor role.                                                                                                                           |                                                       |
| `role_values_admin`                                        | No       | List of comma- or space-separated roles which will be mapped into the Admin role.                                                                                                                            |                                                       |
| `role_values_grafana_admin`                                | No       | List of comma- or space-separated roles which will be mapped into the Grafana Admin (Super Admin) role.                                                                                                      |                                                       |
| `skip_org_role_sync`                                       | No       | Whether to skip organization role synchronization.                                                                                                                                                           | `false`                                               |
| `name_id_format`                                           | No       | Specifies the format of the requested NameID element in the SAML AuthnRequest.                                                                                                                               | `urn:oasis:names:tc:SAML:2.0:nameid-format:transient` |
| `client_id`                                                | No       | Client ID of the IdP service application used to retrieve more information about the user from the IdP. (Microsoft Entra ID only)                                                                            |                                                       |
| `client_secret`                                            | No       | Client secret of the IdP service application used to retrieve more information about the user from the IdP. (Microsoft Entra ID only)                                                                        |                                                       |
| `token_url`                                                | No       | URL to retrieve the access token from the IdP. (Microsoft Entra ID only)                                                                                                                                     |                                                       |
| `force_use_graph_api`                                      | No       | Whether to use the IdP service application retrieve more information about the user from the IdP. (Microsoft Entra ID only)                                                                                  | `false`                                               |

## Example SAML configuration

```ini
[auth.saml]
enabled = true
auto_login = false
certificate_path = "/path/to/certificate.cert"
private_key_path = "/path/to/private_key.pem"
idp_metadata_path = "/my/metadata.xml"
max_issue_delay = 90s
metadata_valid_duration = 48h
assertion_attribute_name = displayName
assertion_attribute_login = mail
assertion_attribute_email = mail

assertion_attribute_groups = Group
assertion_attribute_role = Role
assertion_attribute_org = Org
role_values_viewer = external
role_values_editor = editor, developer
role_values_admin = admin, operator
role_values_grafana_admin = superadmin
org_mapping = Engineering:2:Editor, Engineering:3:Viewer, Sales:3:Editor, *:1:Editor
allowed_organizations = Engineering, Sales
```

## Example SAML configuration in Terraform

```terraform
resource "grafana_sso_settings" "saml_sso_settings" {
  provider_name = "saml"
  saml_settings {
    name                       = "SAML"
    auto_login                 = false
    certificate_path           = "/path/to/certificate.cert"
    private_key_path           = "/path/to/private_key.pem"
    idp_metadata_path          = "/my/metadata.xml"
    max_issue_delay            = "90s"
    metadata_valid_duration    = "48h"
    assertion_attribute_name   = "displayName"
    assertion_attribute_login  = "mail"
    assertion_attribute_email  = "mail"
    assertion_attribute_groups = "Group"
    assertion_attribute_role   = "Role"
    assertion_attribute_org    = "Org"
    role_values_editor         = "editor, developer"
    role_values_admin          = "admin, operator"
    role_values_grafana_admin  = "superadmin"
    org_mapping                = "Engineering:2:Editor, Engineering:3:Viewer, Sales:3:Editor, *:1:Editor"
    allowed_organizations      = "Engineering, Sales"
  }
}
```

Go to [Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/<GRAFANA_VERSION>/docs/resources/sso_settings) for a complete reference on using the `grafana_sso_settings` resource.
