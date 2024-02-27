---
aliases:
  - ../../../alerting-rules/manage-contact-points/integrations/pager-duty/ # /docs/grafana/latest/alerting/alerting-rules/manage-contact-points/integrations/pager-duty/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/pager-duty/
description: Configure the PagerDuty integration for Alerting
keywords:
  - grafana
  - alerting
  - pagerduty
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: PagerDuty
title: Configure PagerDuty for Alerting
weight: 400
---

# Configure PagerDuty for Alerting

To set up PagerDuty, provide an integration key.

| Setting         | Description                                            |
| --------------- | ------------------------------------------------------ |
| Integration Key | Integration key for PagerDuty                          |
| Severity        | Level for dynamic notifications, default is `critical` |
| Custom Details  | Additional details about the event                     |

The `CustomDetails` field is an object containing arbitrary key-value pairs. The user-defined details are merged with the ones we use by default.

Our default values for `CustomDetails` are:

```go
{
	"firing":       `{{ template "__text_alert_list" .Alerts.Firing }}`,
	"resolved":     `{{ template "__text_alert_list" .Alerts.Resolved }}`,
	"num_firing":   `{{ .Alerts.Firing | len }}`,
	"num_resolved": `{{ .Alerts.Resolved | len }}`,
}
```

In case of duplicate keys, the user-defined details overwrite the default ones.
