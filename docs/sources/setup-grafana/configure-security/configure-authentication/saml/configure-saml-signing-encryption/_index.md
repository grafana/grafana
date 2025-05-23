---
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SAML signing and encryption
title: Configure SAML signing and encryption
weight: 530
---

# Configure SAML signing and encryption

Grafana supports signed and encrypted responses, and _only_ supports signed requests.

## Certificate and private key

Commonly, the certificate and key are embedded in the IdP metadata and refreshed as needed by Grafana automatically. However, if your IdP expects signed requests, you must supply a certificate and private key.

The SAML SSO standard uses asymmetric encryption to exchange information between the SP (Grafana) and the IdP. To perform such encryption, you need a public part and a private part. In this case, the X.509 certificate provides the public part, while the private key provides the private part. The private key needs to be issued in a [PKCS#8](https://en.wikipedia.org/wiki/PKCS_8) format.

If you are directly supplying the certificate and key, Grafana supports two ways of specifying both the `certificate` and `private_key`:

- Without a suffix (`certificate` or `private_key`), the configuration assumes you've supplied the base64-encoded file contents.
- With the `_path` suffix (`certificate_path` or `private_key_path`), then Grafana treats the value entered as a path and attempts to read the file from the file system.

{{< admonition type="note" >}}
You can only use one form of each configuration option. Using multiple forms, such as both `certificate` and `certificate_path`, results in an error.
{{< /admonition >}}

Always work with your company's security team on setting up certificates and private keys. If you need to generate them yourself (such as in the short term, for testing purposes, and so on), use the following example to generate your certificate and private key, including the step of ensuring that the key is generated with the [PKCS#8](https://en.wikipedia.org/wiki/PKCS_8) format.

## Signature algorithm

The SAML standard requires digital signatures for security-critical messages such as authentication and logout requests. When you configure the `signature_algorithm` option, Grafana automatically signs these SAML requests using your configured private key and certificate.

### Supported algorithms

- `rsa-sha1`: Legacy algorithm, not recommended for new deployments
- `rsa-sha256`: Recommended for most use cases
- `rsa-sha512`: Strongest security, but may impact performance

### Important considerations

- The signature algorithm must match your IdP configuration exactly
- Mismatched algorithms will cause signature validation failures
- Grafana uses the key and certificate specified in `private_key` and `certificate` options for signing
- We recommend using `rsa-sha256` for new SAML implementations

## Example of private key generation for SAML authentication

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

The base64-encoded values (`key.pem.base64, cert.pem.base64` files) are then used for `certificate` and `private key`.

The key you provide should look like:

```
-----BEGIN PRIVATE KEY-----
...
...
-----END PRIVATE KEY-----
```
