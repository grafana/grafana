---
description: Learn how to configure passwordless authentication with magic links in Grafana
labels:
  products:
    - enterprise
    - oss
menuTitle: Passwordless
title: Configure passwordless authentication with magic links
weight: 200
---

# Configure passwordless authentication with magic links

Passwordless authentication lets Grafana users authenticate with a magic link or one-time password (OTP) sent via email.

## Enable passwordless authentication

{{% admonition type="note" %}}
Passwordless authentication is an experimental feature. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. Enable the `passwordlessMagicLinkAuthentication` feature toggle in Grafana to use this feature.
{{% /admonition %}}

To enable passwordless authentication, use the following configuration:

```bash
[auth.passwordless]
enabled = true
```

## Code expiration

By default, the one-time password (OTP) sent to a user's email is valid for 20 minutes. Use the `code_expiration` option to change the duration that the OTP is valid.

```bash
[auth.passwordless]
enabled = true
code_expiration = 20m
```

## Enable SMTP server

The SMTP server must be enabled so that Grafana can send emails.
The following configuration enables the SMTP server.
For more information on configuring the SMTP server, refer to [SMTP](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#smtp).

```bash
[smtp]
enabled = true
```
