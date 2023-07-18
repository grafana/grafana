---
aliases:
  - ../../provision-alerting-resources/view-provisioned-resources/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/view-provisioned-resources/
description: View provisioned resources in Grafana
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: View provisioned resources in Grafana
title: View provisioned alerting resources in Grafana
weight: 300
---

# View provisioned alerting resources in Grafana

Verify that your alerting resources were created in Grafana.

To view your provisioned resources in Grafana, complete the following steps.

1. Open your Grafana instance.
1. Navigate to Alerting.
1. Click an alerting resource folder, for example, Alert rules.

Provisioned resources are labeled **Provisioned**, so that it is clear that they were not created manually.

## Edit API-provisioned alerting resources

To enable editing of API-provisioned resources in the Grafana UI, add the `X-Disable-Provenance` header to the following requests in the API:

- `POST /api/v1/provisioning/alert-rules`
- `PUT /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}` (calling this endpoint will change provenance for all alert rules within the alert group)
- `POST /api/v1/provisioning/contact-points`
- `POST /api/v1/provisioning/mute-timings`
- `PUT /api/v1/provisioning/policies`
- `PUT /api/v1/provisioning/templates/{name}`

To reset the notification policy tree to the default and unlock it for editing in the Grafana UI, use the `DELETE /api/v1/provisioning/policies` endpoint.

To pass the `X-Disable-Provenance` header from Terraform, add it to the `http_headers` field on the provider object:

```
provider "grafana" {
  url  = "http://grafana.example.com/"
  auth = var.grafana_auth
  http_headers = {
    "X-Disable-Provenance" = "true"
  }
}
```

**Note:**

You cannot edit provisioned resources from files in Grafana. You can only change the resource properties by changing the provisioning file and restarting Grafana or carrying out a hot reload. This prevents changes being made to the resource that would be overwritten if a file is provisioned again or a hot reload is carried out.
