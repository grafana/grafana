---
aliases:
  - /docs/grafana/latest/auth/saml/
  - /docs/grafana/latest/enterprise/saml/troubleshoot-saml/
description: This contains information on how to troubleshoot SAML authentication
  in Grafana
keywords:
  - grafana
  - saml
  - documentation
  - saml-auth
  - enterprise
menuTitle: Troubleshoot SAML Authentication
title: Troubleshoot SAML Authentication in Grafana
weight: 50
---

# Troubleshoot SAML authentication in Grafana

To troubleshoot and get more log information, enable SAML debug logging in the configuration file. Refer to [Configuration]({{< relref "../../administration/configuration.md#filters" >}}) for more information.

```bash
[log]
filters = saml.auth:debug
```

## Known issues

### SAML authentication fails with error:

- `asn1: structure error: tags don't match`

We only support one private key format: PKCS#8.

The keys may be in a different format (PKCS#1 or PKCS#12); in that case, it may be necessary to convert the private key format.

The following command creates a pkcs8 key file.

```bash
$ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes​
```

#### **Convert** the private key format to base64

The following command converts keys to base64 format.

Base64-encode the cert.pem and key.pem files:
(-w0 switch is not needed on Mac, only for Linux)

```sh
$ base64 -w0 key.pem > key.pem.base64
$ base64 -w0 cert.pem > cert.pem.base64
```

The base64-encoded values (`key.pem.base64, cert.pem.base64` files) are then used for certificate and private_key.

The keys you provide should look like:

```
-----BEGIN PRIVATE KEY-----
...
...
-----END PRIVATE KEY-----
```
