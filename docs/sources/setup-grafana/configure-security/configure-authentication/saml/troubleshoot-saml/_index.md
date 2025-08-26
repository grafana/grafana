---
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Troubleshooting
title: Troubleshoot SAML configuration
weight: 590
---

## Troubleshooting

Following are common issues found in configuring SAML authentication in Grafana and how to resolve them.

### Troubleshoot SAML authentication in Grafana

To troubleshoot and get more log information, enable SAML debug logging in the configuration file. Refer to [Configuration](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#filters) for more information.

```ini
[log]
filters = saml.auth:debug
```

### Infinite redirect loop / User gets redirected to the login page after successful login on the IdP side

If you experience an infinite redirect loop when `auto_login = true` or redirected to the login page after successful login, it is likely that the `grafana_session` cookie's SameSite setting is set to `Strict`. This setting prevents the `grafana_session` cookie from being sent to Grafana during cross-site requests. To resolve this issue, set the `security.cookie_samesite` option to `Lax` in the Grafana configuration file.

### SAML authentication fails with error:

- `asn1: structure error: tags don't match`

We only support one private key format: PKCS#8.

The keys may be in a different format (PKCS#1 or PKCS#12); in that case, it may be necessary to convert the private key format.

The following command creates a pkcs8 key file.

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

#### **Convert** the private key format to base64

The following command converts keys to base64 format.

Base64-encode the cert.pem and key.pem files:
(-w0 switch is not needed on Mac, only for Linux)

```sh
$ base64 -w0 key.pem > key.pem.base64
$ base64 -w0 cert.pem > cert.pem.base64
```

The base64-encoded values (`key.pem.base64, cert.pem.base64` files) are then used for certificate and `private_key`.

The keys you provide should look like:

```
-----BEGIN PRIVATE KEY-----
...
...
-----END PRIVATE KEY-----
```

### SAML login attempts fail with request response `origin not allowed`

When the user logs in using SAML and gets presented with `origin not allowed`, the user might be issuing the login from an IdP (identity provider) service or the user is behind a reverse proxy. This potentially happens as the CSRF checks in Grafana deem the requests to be invalid. For more information [CSRF](https://owasp.org/www-community/attacks/csrf).

To solve this issue, you can configure either the [`csrf_trusted_origins`](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#csrf_trusted_origins) or [`csrf_additional_headers`](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#csrf_additional_headers) option in the SAML configuration.

Example of a configuration file:

```ini
# config.ini
...
[security]
csrf_trusted_origins = https://grafana.example.com
csrf_additional_headers = X-Forwarded-Host
...
```

### SAML login attempts fail with request response "login session has expired"

Accessing the Grafana login page from a URL that is not the root URL of the
Grafana server can cause the instance to return the following error: "login session has expired".

If you are accessing Grafana through a proxy server, ensure that cookies are correctly
rewritten to the root URL of Grafana.
Cookies must be set on the same URL as the `root_url` of Grafana. This is normally the reverse proxy's domain/address.

Review the cookie settings in your proxy server configuration to ensure that cookies are
not being discarded

Review the following settings in your Grafana configuration:

```ini
[security]
cookie_samesite = none
```

This setting should be set to none to allow Grafana session cookies to work correctly with redirects.

```ini
[security]
cookie_secure = true
```

Ensure `cookie_secure` is set to true to ensure that cookies are only sent over HTTPS.

### Troubleshoot Graph API calls

When setting up SAML authentication with Azure AD, you may encounter issues with Graph API calls. This can happen if the Azure AD application is not properly configured to allow Graph API access.

To help in the troubleshooting process, test the Graph API calls using the following commands:

```bash
curl -X POST "{token_url}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id={client_id}&client_secret={client_secret}&scope=https://graph.microsoft.com/.default"
```

Where the following values come from your [SAML configuration](../saml-configuration-options/_index.md#saml-configuration-options):

- `token_url`: The token URL of your Azure AD application.
- `client_id`: The client ID of your Azure AD application.
- `client_secret`: The client secret of your Azure AD application.

The response should look like:

```json
{
  "access_token": "...ACCESS_TOKEN...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Use the `access_token` to test the Graph API calls.

```bash
curl -X GET "https://graph.microsoft.com/v1.0/groups" \
  -H "Authorization: Bearer ${access_token}" \
  -H "Content-Type: application/json"
```

The response should look like:

```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#Collection(Edm.String)",
  "value": ["29f2e7c8-9b9d-443c-bc62-7d8cdcfcfe59", "f0224e82-0eb8-4eda-8979-0c36e98deb00"]
}
```

If the second call fails due to 401 or 403, you may need to check the Azure AD application settings to ensure that Graph API access is enabled.
