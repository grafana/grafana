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

```bash
$ openssl pkcs8 -topk8 -nocrypt -in <yourkey> -out private.pem
```
