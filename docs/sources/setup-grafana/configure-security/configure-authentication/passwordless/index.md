---
aliases:
  - ../../../auth/grafana/
description: Learn how to configure passwordless authentication with magic links in Grafana
labels:
  products:
    - enterprise
    - oss
menuTitle: Passwordless auth
title: Configure passwordless authentication with magic links
weight: 200
---

# Passwordless authentication with magic links

The Passwordless integration in Grafana allows your Grafana users to authenticate with a magic link or one-time password (OTP) sent via email.

{{% admonition type="note" %}}
[Passwordless authentication]({{< relref "../passwordless" >}}) is available in [Grafana OSS]({{< relref "../../../../introduction/_index.md" >}}) and in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise" >}}).
{{% /admonition %}}

## Enable passwordless authentication

{{% admonition type="note" %}}
Available in Experimental in Grafana 11.4 behind the `passwordlessMagicLinkAuthentication` feature toggle.
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

The SMTP server must be enabled so that Grafana can send emails. See [SMTP]({{< relref "../../../configure-grafana/_index.md" >}}) for details on configuring the SMTP server.

```bash
[smtp]
enabled = true
```
