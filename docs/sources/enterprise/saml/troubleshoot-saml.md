---
title: 'Troubleshoot SAML Authentication in Grafana'
menuTitle: 'Troubleshoot SAML Authentication'
description: 'This contains information on how to troubleshoot SAML authentication in Grafana'
keywords: ['grafana', 'saml', 'documentation', 'saml-auth']
aliases: ['/docs/grafana/latest/auth/saml/']
weight: 30
---

# Troubleshoot SAML authentication in Grafana

To troubleshoot and get more log information, enable SAML debug logging in the configuration file. Refer to [Configuration]({{< relref "../administration/configuration.md#filters" >}}) for more information.

```bash
[log]
filters = saml.auth:debug
```
