+++
title = "SAML Authentication"
description = "Grafana SAML Authentication"
keywords = ["grafana", "saml", "documentation", "saml-auth"]
aliases = ["/docs/grafana/latest/auth/saml/"]
type = "docs"
[menu.docs]
name = "SAML"
parent = "authentication"
weight = 500
+++

# SAML authentication

SAML authentication integration allows your Grafana users to log in by using an external SAML 2.0 Identity Provider (IdP). To enable this, Grafana becomes a Service Provider (SP) in the authentication flow, interacting with the IdP to exchange user information.

The SAML single-sign-on (SSO) standard is varied and flexible. Our implementation contains the subset of features needed to provide a smooth authentication experience into Grafana.

> Only available in Grafana Enterprise v6.3+. If you encounter any problems with our implementation, please don't hesitate to contact us.

## Supported SAML

Grafana supports the following SAML 2.0 bindings:

* From the Service Provider (SP) to the Identity Provider (IdP):
  - `HTTP-POST` binding
  - `HTTP-Redirect` binding

* From the Identity Provider (IdP) to the Service Provider (SP):
  - `HTTP-POST` binding

In terms of security:
* Grafana supports signed and encrypted assertions. 
* Grafana does not support signed or encrypted requests.

In terms of initiation: 
* Grafana supports SP-initiated requests.
* Grafana does not support IdP-initiated request.

## Set up SAML authentication

The table below describes all SAML configuration options. Continue reading below for details on specific options. Like any other Grafana configuration, you can apply these options as [environment variables]({{< relref "../installation/configuration.md#configure-with-environment-variables" >}}).

| Setting                                                     | Required | Description                                                                                        | Default       |
| ----------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | ------------- |
| `enabled`                                                   | No  | Whether SAML authentication is allowed                                                             | `false`       |
| `certificate` or `certificate_path`                         | Yes | Base64-encoded string or Path for the SP X.509 certificate                                         |               |
| `private_key` or `private_key_path`                         | Yes | Base64-encoded string or Path for the SP private key                                               |               |
| `idp_metadata`, `idp_metadata_path`, or `idp_metadata_url`  | Yes | Base64-encoded string, Path or URL for the IdP SAML metadata XML                                   |               |
| `max_issue_delay`                                           | No  | Duration, since the IdP issued a response and the SP is allowed to process it                      | `90s`         |
| `metadata_valid_duration`                                   | No  | Duration, for how long the SP metadata is valid                                                  | `48h`         |
| `assertion_attribute_name`                                  | No  | Friendly name or name of the attribute within the SAML assertion to use as the user name         | `displayName` |
| `assertion_attribute_login`                                 | No  | Friendly name or name of the attribute within the SAML assertion to use as the user login handle | `mail`        |
| `assertion_attribute_email`                                 | No  | Friendly name or name of the attribute within the SAML assertion to use as the user email        | `mail`        |
| `assertion_attribute_groups`                                | No  | Friendly name or name of the attribute within the SAML assertion to use as the user's groups     |               |
| `assertion_attribute_role`                                  | No  | Friendly name or name of the attribute within the SAML assertion to use as the user's roles      |               |
| `assertion_attribute_org`                                   | No  | Friendly name or name of the attribute within the SAML assertion to use as the user's organization |             |
| `allowed_organizations`                                     | No  | List of comma- or space-separated organizations. User should be a member of at least one organization to log in. |               |
| `org_mapping`                                               | No  | List of comma- or space-separated Organization:OrgId mappings                                  |               |
| `role_values_editor`                                        | No  | List of comma- or space-separated roles which will be mapped into the Editor role               |               |
| `role_values_admin`                                         | No  | List of comma- or space-separated roles which will be mapped into the Admin role                |               |
| `role_values_grafana_admin`                                 | No  | List of comma- or space-separated roles which will be mapped into the Grafana Admin (Super Admin) role |               |

### Enable SAML authentication

To use the SAML integration, in the `auth.saml` section of in the Grafana custom configuration file, set `enabled` to `true`. 

Refer to [Configuration]({{< relref "../installation/configuration.md" >}}) for more information about configuring Grafana.

### Certificate and private key

The SAML SSO standard uses asymmetric encryption to exchange information between the SP (Grafana) and the IdP. To perform such encryption, you need a public part and a private part. In this case, the X.509 certificate provides the public part, while the private key provides the private part.

Grafana supports two ways of specifying both the `certificate` and `private_key`. 
* Without a suffix (`certificate` or `private_key`), the configuration assumes you've supplied the base64-encoded file contents. 
* With the `_path` suffix (`certificate_path` or `private_key_path`), then Grafana treats the value entered as a file path and attempt to read the file from the file system.

You can only use one form of each configuration option. Using multiple forms, such as both `certificate` and `certificate_path`, results in an error.

### IdP metadata

You also need to define the public part of the IdP for message verification. The SAML IdP metadata XML defines where and how Grafana exchanges user information.

Grafana supports three ways of specifying the IdP metadata. 
* Without a suffix `idp_metadata`, Grafana assumes base64-encoded XML file contents.
* With the `_path` suffix, Grafana assumes a file path and attempts to read the file from the file system.
* With the `_url` suffix, Grafana assumes a URL and attempts to load the metadata from the given location.

### Maximum issue delay

Prevents SAML response replay attacks and internal clock skews between the SP (Grafana) and the IdP. You can set a maximum amount of time between the IdP issuing a response and the SP (Grafana) processing it.

The configuration options is specified as a duration, such as `max_issue_delay = 90s` or `max_issue_delay = 1h`.

### Metadata valid duration

SP metadata is likely to expire at some point, perhaps due to a certificate rotation or change of location binding. Grafana allows you to specify for how long the metadata should be valid. Leveraging the `validUntil` field, you can tell consumers until when your metadata is going to be valid. The duration is computed by adding the duration to the current time.

The configuration option is specified as a duration, such as `metadata_valid_duration = 48h`.

### Identity provider (IdP) registration

For the SAML integration to work correctly, you need to make the IdP aware of the SP.

The integration provides two key endpoints as part of Grafana:

* The `/saml/metadata` endpoint, which contains the SP metadata. You can either download and upload it manually, or youmake the IdP request it directly from the endpoint. Some providers name it Identifier or Entity ID.
* The `/saml/acs` endpoint, which is intended to receive the ACS (Assertion Customer Service) callback. Some providers name it SSO URL or Reply URL.

### Assertion mapping

During the SAML SSO authentication flow, Grafana receives the ACS callback. The callback contains all the relevant information of the user under authentication embedded in the SAML response. Grafana parses the response to create (or update) the user within its internal database.

For Grafana to map the user information, it looks at the individual attributes within the assertion. You can think of these attributes as Key/Value pairs (although, they contain more information than that).

Grafana provides configuration options that let you modify which keys to look at for these values. The data we need to create the user in Grafana is Name, Login handle, and email.

An example is `assertion_attribute_name = "givenName"` where Grafana looks within the assertion for an attribute with a friendly name or name of `givenName`. Both, the friendly name (e.g. `givenName`) or the name (e.g. `urn:oid:2.5.4.42`) can be used interchangeably as the value for the configuration option.

### Configure team sync

> Team sync support for SAML only available in Grafana v7.0+

To use SAML Team sync, set [`assertion_attribute_groups`]({{< relref "./configuration.md#assertion-attribute-groups" >}}) to the attribute name where you store user groups. Then Grafana will use attribute values extracted from SAML assertion to add user into the groups with the same name configured on the External group sync tab.

[Learn more about Team Sync]({{< relref "../enterprise/team-sync.md" >}})

### Configure role sync

> Only available in Grafana v7.0+

Role sync allows you to map user roles from an identity provider to Grafana. To enable role sync, configure role attribute and possible values for [Editor]({{< relref "../permissions/organization_roles.md#editor-role" >}}), [Admin]({{< relref "../permissions/organization_roles.md#admin-role" >}}) and [Grafana Admin]({{< relref "../permissions/overview.md#grafana-admin" >}}) roles.

1. In the configuration file, set [`assertion_attribute_role`]({{< relref "./configuration.md#assertion-attribute-role" >}}) option to the attribute name where the role information will be extracted from.
1. Set the [`role_values_editor`]({{< relref "./configuration.md#role-values-editor" >}}) option to the values mapped to the `Editor` role.
1. Set the [`role_values_admin`]({{< relref "./configuration.md#role-values-admin" >}}) option to the values mapped to the organization `Admin` role.
1. Set the [`role_values_grafana_admin`]({{< relref "./configuration.md#role-values-grafana-admin" >}}) option to the values mapped to the `Grafana Admin` role.

If a user role doesn't match any of configured values, then the `Viewer` role will be assigned.

Refer to [Organization roles]({{< relref "../permissions/organization_roles.md" >}}) for more information about roles and permissions in Grafana.

Example configuration:

```bash
[auth.saml]
assertion_attribute_role = role
role_values_editor = editor, developer
role_values_admin = admin, operator
role_values_grafana_admin = superadmin
```

**Important**: When role sync is configured, any changes of user roles and organization membership made manually in Grafana will be overwritten on next user login. Assign user organizations and roles in the IdP instead.

### Configure organization mapping

> Only available in Grafana v7.0+

Organization mapping allows you to assign users to particular organization in Grafana depending on attribute value obtained from identity provider. 

1. In configuration file, set [`assertion_attribute_org`]({{< relref "./configuration.md#assertion-attribute-org" >}}) to the attribute name you store organization info in.
1. Set [`org_mapping`]({{< relref "./configuration.md#org-mapping" >}}) option to the comma-separated list of `Organization:OrgId` pairs to map organization from IdP to Grafana organization specified by id.

For example, use following config to assign users from `Engineering` organization to the Grafana organization with id `2` and users from `Sales` - to the org with id `3`, based on `Org` assertion attribute value:

```bash
[auth.saml]
assertion_attribute_org = Org
org_mapping = Engineering:2, Sales:3
```

You can specify multiple organizations both for the IdP and Grafana:

* `org_mapping = Engineering:2, Sales:2` to map users from `Engineering` and `Sales` to `2` in Grafana.
* `org_mapping = Engineering:2, Engineering:3` to assign `Engineering` to both `2` and `3` in Grafana.

### Configure allowed organizations

> Only available in Grafana v7.0+

With the [`allowed_organizations`]({{< relref "./configuration.md#allowed-organizations" >}}) option you can specify a list of organizations where the user must be a member of at least one of them to be able to log in to Grafana.

## Example SAML configuration

```bash
[auth.saml]
enabled = true
certificate_path = "/path/to/certificate.cert"
private_key_path = "/path/to/private_key.pem"
metadata_path = "/my/metadata.xml"
max_issue_delay = 90s
metadata_valid_duration = 48h
assertion_attribute_name = displayName
assertion_attribute_login = mail
assertion_attribute_email = mail

assertion_attribute_groups = Group
assertion_attribute_role = Role
assertion_attribute_org = Org
role_values_editor = editor, developer
role_values_admin = admin, operator
role_values_grafana_admin = superadmin
org_mapping = Engineering:2, Sales:3
allowed_organizations = Engineering, Sales
```

## Troubleshoot SAML authentication

To troubleshoot and get more log information, enable SAML debug logging in the configuration file. Refer to [Configuration]({{< relref "../installation/configuration.md#filters" >}}) for more information.

```bash
[log]
filters = saml.auth:debug
```
