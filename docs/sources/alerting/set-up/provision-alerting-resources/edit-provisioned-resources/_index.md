---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/edit-provisioned-resources/
description: Export and edit provisioned resources in Grafana
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
  - export
  - edit
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Export and edit provisioned resources in Grafana
title: Export and edit provisioned alerting resources in Grafana
weight: 400
---

# Export and edit provisioned alerting resources in Grafana

Export your alerting resources, such as alert rules, contact points, and notification policies in JSON, YAML, or Terraform format. A new **Modify export** mode for alert rules enables you to edit provisioned alert rules and export a modified version.

{{% admonition type="note" %}}
This feature is for Grafana-managed alert rules only. It is available to Admin, Viewer, and Editor roles.
{{% /admonition %}}

## Steps

To edit provisioned alerting resources from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Alert rules**.
1. Locate the alert rule you want to edit and click **More** -> **Modify Export** to open the Alert Rule form.
1. From the Alert Rule form, edit the fields you want to change.
1. Click **Export** to export all alert rules within the group.

   You can only export groups of rules; not single rules.

   The exported rule data appears in different formats - HTML, JSON, Terraform.

1. Choose the format to export in.

1. Click **Copy Code** or **Download**.

   Choose **Copy Code** to go to an existing file and paste in the code.
   Choose **Download** to download a file with the exported data.
