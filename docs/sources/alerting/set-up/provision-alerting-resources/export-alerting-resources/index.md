---
aliases:
  - ../../provision-alerting-resources/view-provisioned-resources/
  - ./view-provisioned-resources/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/export-alerting-resources/
description: Export alerting resources in Grafana
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
menuTitle: Export alerting resources
title: Export alerting resources
weight: 400
---

# Export alerting resources

Export your alerting resources, such as alert rules, contact points, and notification policies in JSON, YAML, or Terraform format. You can export all Grafana-managed alert rules, single folders, and single groups.

To export alert rules from the Grafana UI, complete the following steps.

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

## Export modified rules without saving changes

Use the **Modify export** mode to modify and export an alert rule without saving the changes.

{{% admonition type="note" %}} This feature is for Grafana-managed alert rules only. It is available to Admin, Viewer, and Editor roles. {{% /admonition %}}

To export a modified alert rule without saving the modifications, complete the following steps from the Grafana UI.

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
