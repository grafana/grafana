+++
title = "SAML Authentication"
description = "Grafana SAML Authentication"
keywords = ["grafana", "saml", "documentation", "saml-auth"]
aliases = ["/auth/saml/"]
type = "docs"
[menu.docs]
name = "SAML"
parent = "authentication"
weight = 5
+++

# SAML Authentication

> Only available in Grafana v6.3+

The SAML authentication integration allows your Grafana users to log in by
using an external SAML Identity Provider (IdP). To enable this, Grafana becomes
a Service Provider (SP) in the authentication flow, interacting with the IdP to
exchange user information.

## Supported SAML

The SAML single-sign-on (SSO) standard is varied and flexible. Our implementation contains the subset of features needed to provide a smooth authentication experience into Grafana.

> Should you encounter any problems with our implementation, please don't hesitate to contact us.

At the moment of writing, Grafana supports:

1. From the Service Provider (SP) to the Identity Provider (IdP)

    - `HTTP-POST` binding
    - `HTTP-Redirect` binding

2. From the Identity Provider (IdP) to the Service Provider (SP)

    - `HTTP-POST` binding

## Set up SAML Authentication

To use the SAML integration, you need to enable SAML in the [main config file]({{< relref "installation/configuration.md" >}}).

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
```

Important to note:

- like any other Grafana configuration, use of [environment variables for these options is supported]({{< relref "installation/configuration.md#using-environment-variables" >}})
- only one form of configuration option is required. Using multiple forms, e.g. both `certificate` and `certificate_path` will result in an error

## Grafana Configuration

An example working configuration example looks like:

```bash
[auth.saml]
enabled = true
certificate_path = "/path/to/certificate.cert"
private_key_path = "/path/to/private_key.pem"
metadata_path = "/my/metadata.xml"
max_issue_delay = 90s
metadata_valid_duration = 48h
```

And here is a comprehensive list of the options:

| Setting                   | Required | Description                                                                    | Default |
|---------------------------|----------|--------------------------------------------------------------------------------|---------|
| `eanbled`                 | No       | Whenever SAML authentication is allowed                                        | `false` |
| `certificate|_path`       | Yes      | Base64-encoded string or Path for the SP X.509 certificate                     |         |
| `private_key|_path`       | Yes      | Base64-encoded string or Path for the SP private key                           |         |
| `idp_metadata|_path|_url` | Yes      | Base64-encoded string, Path or URL for the IdP SAML metadata XML               |         |
| `max_issue_delay`         | No       | Duration, since the IdP issued a response and the SP is allowed to process it  | `90s`   |
| `metadata_valid_duration` | No       | Duration, for how long the SP's metadata should be valid                       | `48h`   |

### Cert and Private Key

The SAML SSO standard uses asymmetric encryption to exchange information between the SP (Grafana) and the IdP. To perform such encryption, you need a public part and a private part. In this case, the X.509 certificate provides the public part, while the private key provides the private part.

Grafana supports two ways of specifying both the `certificate` and `private_key`. Without a suffix (e.g. `certificate=`), the configuration assumes you've supplied the base64-encoded file contents. However, if specified with the `_path` suffix (e.g. `certificate_path=`) Grafana will treat it as a file path and attempt to read the file from the file system.

### IdP Metadata

Expanding on the above, we'll also need the public part from our IdP for message verification. The SAML IdP metadata XML tells us where and how we should exchange the user information.

Currently, we support three ways of specifying the IdP metadata. Without a suffix `idp_metadata=` Grafana assumes base64-encoded XML file contents, with the `_path` suffix assumes a file path and attempts to read the file from the file system and with the `_url` suffix assumes an URL and attempts to load the metadata from the given location.

### Max Issue Delay

Prevention of SAML response replay attacks and internal clock skews between the SP (Grafana) and the IdP is covered. You can set a maximum amount of time between the IdP issuing a response and the SP (Grafana) processing it.

The configuration options is specified as a duration e.g. `max_issue_delay = 90s` or `max_issue_delay = 1h`

### Metadata valid duration

As an SP, our metadata is likely to expire at some point, e.g. due to a certificate rotation or change of location binding. Grafana allows you to specify for how long the metadata should be valid. Leveraging the standard's `validUntil` field, you can tell consumers until when your metadata is going to be valid. The duration is computed by adding the duration to the current time.

The configuration option is specified as a duration e.g. `metadata_valid_duration = 48h`

## Identity Provider (IdP) registration

Finally, for the SAML integration to work correctly, you need to make the IdP aware of the SP. You need to provide the IdP with the SP's metadata. 

Grafana provides an endpoint for such at `/saml/metadata`. You can either download the metadata and upload it manually, or make the IdP request it directly from the endpoint.

## Troubleshooting

To troubleshoot and get more log info enable saml debug logging in the [main config file]({{< relref "installation/configuration.md" >}}).

```bash
[log]
filters = saml.auth:debug
```
