---
aliases:
  - /docs/grafana/latest/auth/saml/
  - /docs/grafana/latest/enterprise/saml/enable-saml/
description: This contains information to enable SAML authentication in Grafana
keywords:
  - grafana
  - saml
  - documentation
  - saml-auth
  - enterprise
menuTitle: Enable SAML authentication
title: Enable SAML authentication in Grafana
weight: 30
---

# Enable SAML authentication in Grafana

To use the SAML integration, in the `auth.saml` section of in the Grafana custom configuration file, set `enabled` to `true`.

Refer to [Configuration]({{< relref "../../administration/configuration.md" >}}) for more information about configuring Grafana.

## Certificate and private key

The SAML SSO standard uses asymmetric encryption to exchange information between the SP (Grafana) and the IdP. To perform such encryption, you need a public part and a private part. In this case, the X.509 certificate provides the public part, while the private key provides the private part. The private key needs to be issued in a [PKCS#8](https://en.wikipedia.org/wiki/PKCS_8) format.

Grafana supports two ways of specifying both the `certificate` and `private_key`.

- Without a suffix (`certificate` or `private_key`), the configuration assumes you've supplied the base64-encoded file contents.
- With the `_path` suffix (`certificate_path` or `private_key_path`), then Grafana treats the value entered as a file path and attempts to read the file from the file system.

> **Note:** You can only use one form of each configuration option. Using multiple forms, such as both `certificate` and `certificate_path`, results in an error.

---

### **Example** of how to generate SAML credentials:

An example of how to generate a self-signed certificate and private key that's valid for one year:

```sh
$ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes​
```

Base64-encode the cert.pem and key.pem files:
(-w0 switch is not needed on Mac, only for Linux)

```sh
$ base64 -w0 key.pem > key.pem.base64
$ base64 -w0 cert.pem > cert.pem.base64
```

The base64-encoded values (`key.pem.base64, cert.pem.base64` files) are then used for certificate and private_key.

The keys you provide should look like:

It should look like:

```
-----BEGIN PRIVATE KEY-----
...
...
-----END PRIVATE KEY-----
```

If you have a key that looks like:

```
-----BEGIN CERTIFICATE-----
...
...
-----END CERTIFICATE-----
```
