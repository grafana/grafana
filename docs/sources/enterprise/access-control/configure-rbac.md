---
title: 'Configure RBAC'
menuTitle: 'Configure RBAC'
description: 'Learn how to configure RBAC.'
aliases: []
weight: 30
---

# Configure RBAC in Grafana

The table below describes all RBAC configuration options. Continue reading below for details on specific options. Like any other Grafana configuration, you can apply these options as [environment variables]({{< relref "../../administration/configuration.md#configure-with-environment-variables" >}}).

| Setting            | Required | Description                                   | Default |
| ------------------ | -------- | --------------------------------------------- | ------- |
| `permission_cache` | No       | Enable to use in memory cache for permissions | `true`  |

## Example RBAC configuration

```bash
[rbac]
permission_cache = true
```
