+++
title = "SAML Authentication"
description = "Grafana SAML Authentication"
keywords = ["grafana", "saml", "documentation", "saml-auth"]
aliases = ["/docs/grafana/latest/auth/saml/"]
type = "docs"
[menu.docs]
name = "SAML"
parent = "authentication"
weight = 5
+++

# SAML authentication

> Only available in Grafana Enterprise v6.3+.

The SAML authentication integration allows your Grafana users to log in by using an external SAML Identity Provider (IdP). To enable this, Grafana becomes a Service Provider (SP) in the authentication flow, interacting with the IdP to exchange user information.

## Supported SAML

The SAML single-sign-on (SSO) standard is varied and flexible. Our implementation contains the subset of features needed to provide a smooth authentication experience into Grafana.

> Should you encounter any problems with our implementation, please don't hesitate to contact us.

Grafana supports:

* From the Service Provider (SP) to the Identity Provider (IdP)

    - `HTTP-POST` binding
    - `HTTP-Redirect` binding

* From the Identity Provider (IdP) to the Service Provider (SP)

    - `HTTP-POST` binding

* In terms of security, we currently support signed and encrypted Assertions. However, signed or encrypted requests are not supported.

* In terms of initiation, only SP-initiated requests are supported. There's no support for IdP-initiated request.

## Set up SAML authentication

To use the SAML integration, you need to enable SAML in the [main config file]({{< relref "../installation/configuration.md" >}}).

```bash
[auth.saml]
# Defaults to false. If true, the feature is enabled
enabled = true

# Base64-encoded public X.509 certificate. Used to sign requests to the IdP
certificate =

# Path to the public X.509 certificate. Used to sign requests to the IdP
certificate_path =

# Base64-encoded private key. Used to decrypt assertions from the IdP
private_key =

# Path to the private key. Used to decrypt assertions from the IdP
private_key_path =

# Base64-encoded IdP SAML metadata XML. Used to verify and obtain binding locations from the IdP
idp_metadata =

# Path to the SAML metadata XML. Used to verify and obtain binding locations from the IdP
idp_metadata_path =

# URL to fetch SAML IdP metadata. Used to verify and obtain binding locations from the IdP
idp_metadata_url =

# Duration, since the IdP issued a response and the SP is allowed to process it. Defaults to 90 seconds
max_issue_delay =

# Duration, for how long the SP's metadata should be valid. Defaults to 48 hours
metadata_valid_duration =

# Friendly name or name of the attribute within the SAML assertion to use as the user's name
assertion_attribute_name = displayName

# Friendly name or name of the attribute within the SAML assertion to use as the user's login handle
assertion_attribute_login = mail

# Friendly name or name of the attribute within the SAML assertion to use as the user's email
assertion_attribute_email = mail
```

Important to note:

- Like any other Grafana configuration, use of [environment variables for these options is supported]({{< relref "../installation/configuration.md#using-environment-variables" >}})
- Only one form of configuration option is required. Using multiple forms, e.g. both `certificate` and `certificate_path` will result in an error

## Grafana configuration

Example working configuration:

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
```

Available options:

| Setting                                                     | Required | Description                                                                                        | Default       |
| ----------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | ------------- |
| `enabled`                                                   | No       | Whenever SAML authentication is allowed                                                            | `false`       |
| `certificate` or `certificate_path`                         | Yes      | Base64-encoded string or Path for the SP X.509 certificate                                         |               |
| `private_key` or `private_key_path`                         | Yes      | Base64-encoded string or Path for the SP private key                                               |               |
| `idp_metadata` or `idp_metadata_path` or `idp_metadata_url` | Yes      | Base64-encoded string, Path or URL for the IdP SAML metadata XML                                   |               |
| `max_issue_delay`                                           | No       | Duration, since the IdP issued a response and the SP is allowed to process it                      | `90s`         |
| `metadata_valid_duration`                                   | No       | Duration, for how long the SP's metadata should be valid                                           | `48h`         |
| `assertion_attribute_name`                                  | No       | Friendly name or name of the attribute within the SAML assertion to use as the user's name         | `displayName` |
| `assertion_attribute_login`                                 | No       | Friendly name or name of the attribute within the SAML assertion to use as the user's login handle | `mail`        |
| `assertion_attribute_email`                                 | No       | Friendly name or name of the attribute within the SAML assertion to use as the user's email        | `mail`        |

### Cert and private key

The SAML SSO standard uses asymmetric encryption to exchange information between the SP (Grafana) and the IdP. To perform such encryption, you need a public part and a private part. In this case, the X.509 certificate provides the public part, while the private key provides the private part.

Grafana supports two ways of specifying both the `certificate` and `private_key`. Without a suffix (e.g. `certificate=`), the configuration assumes you've supplied the base64-encoded file contents. However, if specified with the `_path` suffix (e.g. `certificate_path=`) Grafana will treat it as a file path and attempt to read the file from the file system.

### IdP metadata

Expanding on the above, we'll also need the public part from our IdP for message verification. The SAML IdP metadata XML tells us where and how we should exchange the user information.

Currently, we support three ways of specifying the IdP metadata. Without a suffix `idp_metadata=` Grafana assumes base64-encoded XML file contents, with the `_path` suffix assumes a file path and attempts to read the file from the file system and with the `_url` suffix assumes an URL and attempts to load the metadata from the given location.

### Max issue delay

Prevention of SAML response replay attacks and internal clock skews between the SP (Grafana), and the IdP is covered. You can set a maximum amount of time between the IdP issuing a response and the SP (Grafana) processing it.

The configuration options is specified as a duration e.g. `max_issue_delay = 90s` or `max_issue_delay = 1h`

### Metadata valid duration

As an SP, our metadata is likely to expire at some point, e.g. due to a certificate rotation or change of location binding. Grafana allows you to specify for how long the metadata should be valid. Leveraging the standard's `validUntil` field, you can tell consumers until when your metadata is going to be valid. The duration is computed by adding the duration to the current time.

The configuration option is specified as a duration e.g. `metadata_valid_duration = 48h`

## Identity provider (IdP) registration

For the SAML integration to work correctly, you need to make the IdP aware of the SP.

The integration provides two key endpoints as part of Grafana:

- The `/saml/metadata` endpoint. Which contains the SP's metadata. You can either download and upload it manually or make the IdP request it directly from the endpoint. Some providers name it Identifier or Entity ID.

- The `/saml/acs` endpoint. Which is intended to receive the ACS (Assertion Customer Service) callback. Some providers name it SSO URL or Reply URL.

## Assertion mapping

During the SAML SSO authentication flow, we receive the ACS (Assertion Customer Service) callback. The callback contains all the relevant information of the user under authentication embedded in the SAML response. Grafana parses the response to create (or update) the user within its internal database.

For Grafana to map the user information, it looks at the individual attributes within the assertion. You can think of these attributes as Key/Value pairs (although, they contain more information than that).

Grafana provides configuration options that let you modify which keys to look at for these values. The data we need to create the user in Grafana is Name, Login handle, and email.

An example is `assertion_attribute_name = "givenName"` where Grafana looks within the assertion for an attribute with a friendly name or name of `givenName`. Both, the friendly name (e.g. `givenName`) or the name (e.g. `urn:oid:2.5.4.42`) can be used interchangeably as the value for the configuration option.

## Troubleshooting

To troubleshoot and get more log info enable saml debug logging in the [main config file]({{< relref "../installation/configuration.md" >}}).

```bash
[log]
filters = saml.auth:debug
```
