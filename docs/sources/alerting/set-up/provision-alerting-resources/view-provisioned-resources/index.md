---
aliases:
  - ../../provision-alerting-resources/view-provisioned-resources/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/view-provisioned-resources/
description: Manage provisioned alerting resources in Grafana
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
menuTitle: Manage provisioned resources in Grafana
title: Manage provisioned alerting resources in Grafana
weight: 300
---

# Manage provisioned alerting resources in Grafana

Verify that your alerting resources were created in Grafana, as well as edit or export your provisioned alerting resources.

## View provisioned alerting resoureces

To view your provisioned resources in Grafana, complete the following steps.

1. Open your Grafana instance.
1. Navigate to Alerting.
1. Click an alerting resource folder, for example, Alert rules.

Provisioned resources are labeled **Provisioned**, so that it is clear that they were not created manually.

## Export provisioned alerting resources

Export your alerting resources, such as alert rules, contact points, and notification policies in JSON, YAML, or Terraform format. You can export all Grafana-managed alert rules, single folders, and single groups.

To export provisioned alerting resources from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Alert rules**.
1. To export all Grafana-managed rules, click **Export rules**.
1. To export a folder, change the **View as** to **List**.
1. Select the folder you want to export and click the **Export rules folder** icon.
1. To export a group, change the **View as** to **Grouped**.
1. Find the group you want to export and click the **Export rule group** icon.
1. Choose the format to export in.

   Note that formats JSON and YAML are suitable only for file provisioning. To get rule definition in provisioning API format, use the provisioning GET API.

1. Click **Copy Code** or **Download**.
1. Choose **Copy Code** to go to an existing file and paste in the code.
1. Choose **Download** to download a file with the exported data.

## Edit provisioned alert rules

Use the **Modify export** mode for alert rules to edit provisioned alert rules and export a modified version.

{{% admonition type="note" %}} This feature is for Grafana-managed alert rules only. It is available to Admin, Viewer, and Editor roles. {{% /admonition %}}

To edit provisioned alerting alert rules from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Alert rules**.
1. Locate the alert rule you want to edit and click **More** -> **Modify Export** to open the Alert Rule form.
1. From the Alert Rule form, edit the fields you want to change.
1. Click **Export** to export all alert rules within the group.

   You can only export groups of rules; not single rules.
   The exported rule data appears in different formats - HTML, JSON, Terraform.

1. Choose the format to export in.
1. Click **Copy Code** or **Download**.

   a. Choose **Copy Code** to go to an existing file and paste in the code.

   b. Choose **Download** to download a file with the exported data.

## Edit API-provisioned alerting resources

To enable editing of API-provisioned resources in the Grafana UI, add the `X-Disable-Provenance` header to the following requests in the API:

- `POST /api/v1/provisioning/alert-rules`
- `PUT /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}` (calling this endpoint will change provenance for all alert rules within the alert group)
- `POST /api/v1/provisioning/contact-points`
- `POST /api/v1/provisioning/mute-timings`
- `PUT /api/v1/provisioning/policies`
- `PUT /api/v1/provisioning/templates/{name}`

To reset the notification policy tree to the default and unlock it for editing in the Grafana UI, use the `DELETE /api/v1/provisioning/policies` endpoint.

In Terraform, you can use the `disable_provenance` attribute on alerting resources:

```
provider "grafana" {
  url  = "http://grafana.example.com/"
  auth = var.grafana_auth
}

resource "grafana_mute_timing" "mute_all" {
  name = "mute all"
  disable_provenance = true
  intervals {}
}
```

**Note:**

You cannot edit provisioned resources from files in Grafana. You can only change the resource properties by changing the provisioning file and restarting Grafana or carrying out a hot reload. This prevents changes being made to the resource that would be overwritten if a file is provisioned again or a hot reload is carried out.
