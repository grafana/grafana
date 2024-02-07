---
aliases:
  - ../provision-alerting-resources/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/
description: Import and export alerting resources
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - provisioning
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Import and export Grafana Alerting resources
weight: 300
---

# Import and export Grafana Alerting resources

Alerting infrastructure is often complex, with many pieces of the pipeline that often live in different places. Scaling this across multiple teams and organizations is an especially challenging task. Importing and exporting (or provisioning) your alerting resources in Grafana Alerting makes this process easier by enabling you to create, manage, and maintain your alerting data in a way that best suits your organization.

You can import alert rules, contact points, notification policies, mute timings, and templates.

You cannot edit imported alerting resources in the Grafana UI in the same way as alerting resources that were not imported. You can only edit imported contact points, notification policies, templates, and mute timings in the source where they were created. For example, if you manage your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

To modify imported alert rules, you can use the **Modify export** feature to edit and then export.

Choose from the options below to import your Grafana Alerting resources.

1. Use file provisioning to manage your Grafana Alerting resources, such as alert rules and contact points, through files on disk.

   {{% admonition type="note" %}}
   File provisioning is not available in Grafana Cloud instances.
   {{% /admonition %}}

2. Use the Alerting Provisioning HTTP API.

   For more information on the Alerting Provisioning HTTP API, refer to [Alerting provisioning HTTP API][alerting_provisioning].

   Here is a ready-to-use template for alert rules:

   #### Alert rules template

```
{
    "title": "TEST-API_1",
    "ruleGroup": "API",
    "folderUID": "FOLDER",
    "noDataState": "OK",
    "execErrState": "OK",
    "for": "5m",
    "orgId": 1,
    "uid": "",
    "condition": "B",
    "annotations": {
        "summary": "test_api_1"
    },
    "labels": {
        "API": "test1"
    },
    "data": [
        {
            "refId": "A",
            "queryType": "",
            "relativeTimeRange": {
                "from": 600,
                "to": 0
            },
            "datasourceUid": " XXXXXXXXX-XXXXXXXXX-XXXXXXXXXX",
            "model": {
                "expr": "up",
                "hide": false,
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "refId": "A"
            }
        },
        {
            "refId": "B",
            "queryType": "",
            "relativeTimeRange": {
                "from": 0,
                "to": 0
            },
            "datasourceUid": "-100",
            "model": {
                "conditions": [
                    {
                        "evaluator": {
                            "params": [
                                6
                            ],
                            "type": "gt"
                        },
                        "operator": {
                            "type": "and"
                        },
                        "query": {
                            "params": [
                                "A"
                            ]
                        },
                        "reducer": {
                            "params": [],
                            "type": "last"
                        },
                        "type": "query"
                    }
                ],
                "datasource": {
                    "type": "__expr__",
                    "uid": "-100"
                },
                "hide": false,
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "refId": "B",
                "type": "classic_conditions"
            }
        }
    ]
}
```

3. Use [Terraform](https://www.terraform.io/).

**Useful Links:**

[Grafana provisioning][provisioning]

[Grafana Alerting provisioning API][alerting_provisioning]

{{% docs/reference %}}
[alerting_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/developers/http_api/alerting_provisioning"
[alerting_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/developers/http_api/alerting_provisioning"

[provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning"
[provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning"
{{% /docs/reference %}}
