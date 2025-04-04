---
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SAML request signing
title: Configure SAML request signing
weight: 530
---

## Signing and encryption

Grafana supports signed and encrypted assertions, and does _not_ support encrypted requests.

## Certificate and private key

Commonly, the certificate and key are embedded in the [IDP metadata](#configure-the-saml-toolkit-application-endpoints) and refreshed as needed by Grafana automatically. However, if your IdP expects signed requests, you must supply a certificate and private key.

The SAML SSO standard uses asymmetric encryption to exchange information between the SP (Grafana) and the IdP. To perform such encryption, you need a public part and a private part. In this case, the X.509 certificate provides the public part, while the private key provides the private part. The private key needs to be issued in a [PKCS#8](https://en.wikipedia.org/wiki/PKCS_8) format.

If you are directly supplying the certificate and key, Grafana supports two ways of specifying both the `certificate` and `private_key`:

- Without a suffix (`certificate` or `private_key`), the configuration assumes you've supplied the base64-encoded file contents.
- With the `_path` suffix (`certificate_path` or `private_key_path`), then Grafana treats the value entered as a file path and attempts to read the file from the file system.

{{% admonition type="note" %}}
You can only use one form of each configuration option. Using multiple forms, such as both `certificate` and `certificate_path`, results in an error.
{{% /admonition %}}

Always work with your company's security team on setting up certificates and private keys. If you need to generate them yourself (such as in the short term, for testing purposes, and so on), use the following example to generate your certificate and private key, including the step of ensuring that the key is generated with the [PKCS#8](https://en.wikipedia.org/wiki/PKCS_8) format.

### Example of private key generation for SAML authentication

An example of how to generate a self-signed certificate and private key that's valid for one year:

```sh
$ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes​
```

Base64-encode the cert.pem and key.pem files:
(-w0 switch is not needed on Mac, only for Linux)

```sh
$ base64 -i key.pem -o key.pem.base64
$ base64 -i cert.pem -o cert.pem.base64
```

The base64-encoded values (`key.pem.base64, cert.pem.base64` files) are then used for certificate and private key.

The key you provide should look like:

```
-----BEGIN PRIVATE KEY-----
...
...
-----END PRIVATE KEY-----
```

### Signature algorithm

The SAML standard recommends using a digital signature for some types of messages, like authentication or logout requests. If the `signature_algorithm` option is configured, Grafana will put a digital signature into SAML requests. Supported signature types are `rsa-sha1`, `rsa-sha256`, `rsa-sha512`. This option should match your IdP configuration, otherwise, signature validation will fail. Grafana uses key and certificate configured with `private_key` and `certificate` options for signing SAML requests.