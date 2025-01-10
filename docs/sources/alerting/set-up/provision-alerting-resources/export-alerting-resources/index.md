---
aliases:
  - ../../provision-alerting-resources/view-provisioned-resources/ # /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/view-provisioned-resources/
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
title: Export alerting resources
weight: 300
refs:
  alerting_file_provisioning:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning/
  export_mute_timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-mute-timings-exportspan-export-all-mute-timings-in-provisioning-file-format-_routegetmutetimingsexport_
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-mute-timings-exportspan-export-all-mute-timings-in-provisioning-file-format-_routegetmutetimingsexport_
  export_rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-alert-rules-exportspan-export-all-alert-rules-in-provisioning-file-format-_routegetalertrulesexport_
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-alert-rules-exportspan-export-all-alert-rules-in-provisioning-file-format-_routegetalertrulesexport_
  alerting_file_provisioning_template:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning/#import-templates
  export_rule_group:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-alert-rule-group-exportspan-export-an-alert-rule-group-in-provisioning-file-format-_routegetalertrulegroupexport_
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-alert-rule-group-exportspan-export-an-alert-rule-group-in-provisioning-file-format-_routegetalertrulegroupexport_
  alerting_tf_provisioning_template:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/#import-contact-points-and-templates
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning/#import-contact-points-and-templates
  export_mute_timing:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-mute-timing-exportspan-export-a-mute-timing-in-provisioning-file-format-_routegetmutetimingexport_
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-mute-timing-exportspan-export-a-mute-timing-in-provisioning-file-format-_routegetmutetimingexport_
  alerting_http_mutetimings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#mute-timings
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/#mute-timings
  alerting_http_alertrules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#alert-rules
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/#alert-rules
  alerting_tf_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning/
  export_rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-alert-rule-exportspan-export-an-alert-rule-in-provisioning-file-format-_routegetalertruleexport_
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-alert-rule-exportspan-export-an-alert-rule-in-provisioning-file-format-_routegetalertruleexport_
  alerting_http_templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#notification-template-groups
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/#notification-template-groups
  alerting_http_contactpoints:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#contact-points
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/#contact-points
  alerting_http_notificationpolicies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#notification-policies
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/#notification-policies
  export_notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-policy-tree-exportspan-export-the-notification-policy-tree-in-provisioning-file-format-_routegetpolicytreeexport_
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-policy-tree-exportspan-export-the-notification-policy-tree-in-provisioning-file-format-_routegetpolicytreeexport_
  alerting_http_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/
  export_contacts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-contactpoints-exportspan-export-all-contact-points-in-provisioning-file-format-_routegetcontactpointsexport_
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#span-idroute-get-contactpoints-exportspan-export-all-contact-points-in-provisioning-file-format-_routegetcontactpointsexport_
---

# Export alerting resources

Export your alerting resources, such as alert rules, contact points, and notification policies for provisioning, automatically importing single folders and single groups.

There are distinct methods to export your alerting resources:

- [Grafana UI](#export-from-the-grafana-ui) exports in Terraform format and YAML or JSON formats for file provisioning.
- [HTTP Alerting API](#http-alerting-api) exports in JSON API format used by the HTTP Alerting API.
- [HTTP Alerting API - Export endpoints](#export-api-endpoints) exports in YAML or JSON formats for file provisioning.

{{< admonition type="note" >}}
Alerting resources imported through [file provisioning](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning) cannot be edited in the Grafana UI. This prevents changes made in the UI from being overridden by file provisioning during Grafana restarts.

If you need to modify provisioned alerting resources in Grafana, refer to [edit HTTP API alerting resources in the Grafana UI](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#edit-resources-in-the-grafana-ui) or to [edit Terraform alerting resources in the Grafana UI](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning#enable-editing-resources-in-the-grafana-ui).
{{< /admonition >}}

## Export from the Grafana UI

The export options listed below enable you to download resources in YAML, JSON, or Terraform format, facilitating their provisioning through [configuration files](ref:alerting_file_provisioning) or [Terraform](ref:alerting_tf_provisioning).

### Export alert rules

To export alert rules from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Alert rules**.
1. To export all Grafana-managed rules, click **Export rules**.
1. To export a folder, change the **View as** to **List**.
1. Select the folder you want to export and click the **Export rules folder** icon.
1. To export a group, change the **View as** to **Grouped**.
1. Find the group you want to export and click the **Export rule group** icon.
1. Choose the format to export in.

   The exported alert rule data appears in different formats - YAML, JSON, Terraform.

1. Click **Copy Code** or **Download**.

### Modify alert rule and export rule group without saving changes

{{% admonition type="note" %}} This feature is for Grafana-managed alert rules only. It is available to Admin, Viewer, and Editor roles. {{% /admonition %}}

Use the **Modify export** mode to edit and export an alert rule without updating it. The exported data includes all alert rules within the same alert group.

To export a modified alert rule without saving the modifications, complete the following steps from the Grafana UI.

1. Click **Alerts & IRM** -> **Alert rules**.
1. Locate the alert rule you want to edit and click **More** -> **Modify Export** to open the Alert Rule form.
1. From the Alert Rule form, edit the fields you want to change. Changes made are not applied to the alert rule.
1. Click **Export**.
1. Choose the format to export in.

   The exported alert rule group appears in different formats - YAML, JSON, Terraform.

1. Click **Copy Code** or **Download**.

### Export a new alert rule definition without saving changes

{{% admonition type="note" %}} You can only export in Terraform (HCL) format. {{% /admonition %}}

Add a new alert rule definition to an existing provisioned rule group rather than creating the code manually. You can then copy it to your Terraform pipeline, and quickly deploy and manage alert rules as part of your infrastructure as code.

An alert rule definition differs from an alert rule in the sense that you define your alert rule, but you do not save it. It only becomes a saved alert rule once you provision it using Terraform.

To export your alert rule definition into Terraform (HCL) format, complete the following steps.

1. Click **Alerts & IRM** -> **Alert rules**.
2. Click **Export rule definition**.
3. Fill out the alert rule details.
4. Choose a provisioned folder and group to add your alert rule definition to.
5. Click **Export**.
6. Copy and paste the code into your Terraform pipeline to create your new alert rule.

### Export contact points

To export contact points from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Contact points**.
1. Find the contact point you want to export and click **More** -> **Export**.
1. Choose the format to export in.

   The exported contact point appears in different formats - YAML, JSON, Terraform.

1. Click **Copy Code** or **Download**.

### Export notification template groups

Grafana currently doesn't offer an Export UI or [Export endpoint](#export-api-endpoints) for notification template groups, unlike other Alerting resources presented in this documentation.

However, you can export it by manually copying the content and name of the notification template group from the Grafana UI.

1. Click **Alerts & IRM** -> **Contact points** -> **Notification templates** tab.
1. Find the notification template group you want to export.
1. Copy the content and name.
1. Adjust it for the [file provisioning format](ref:alerting_file_provisioning_template) or [Terraform resource](ref:alerting_tf_provisioning_template).

### Export the notification policy tree

All notification policies are provisioned through a single resource: the root of the notification policy tree.

{{% admonition type="warning" %}}

Since the policy tree is a single resource, provisioning it overwrites a policy tree created through any other means.

{{< /admonition >}}

To export the notification policy tree from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Notification policies**.
2. In the **Default notification policy** section, click **...** -> **Export**.
3. Choose the format to export in.

   The exported contact point appears in different formats - YAML, JSON, Terraform.

4. Click **Copy Code** or **Download**.

### Export mute timings

To export mute timings from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Notification policies**, and then the **Mute timings** tab.
1. Find the mute timing you want to export and click **Export**.
1. Choose the format to export in.

   The exported contact point appears in different formats - YAML, JSON, Terraform.

1. Click **Copy Code** or **Download**.

## HTTP Alerting API

You can use the [Alerting HTTP API](ref:alerting_http_provisioning) to return existing alerting resources in JSON and import them to another Grafana instance using the same endpoint.

| Resource                                                           | URI                                 |
| ------------------------------------------------------------------ | ----------------------------------- |
| [Alert rules](ref:alerting_http_alertrules)                        | /api/v1/provisioning/alert-rules    |
| [Contact points](ref:alerting_http_contactpoints)                  | /api/v1/provisioning/contact-points |
| [Notification policy tree](ref:alerting_http_notificationpolicies) | /api/v1/provisioning/policies       |
| [Notification template groups](ref:alerting_http_templates)        | /api/v1/provisioning/templates      |
| [Mute timings](ref:alerting_http_mutetimings)                      | /api/v1/provisioning/mute-timings   |

However, note the standard endpoints return a JSON format that is not compatible for provisioning through configuration files or Terraform, except the `/export` endpoints listed below.

### Export API endpoints

The **Alerting HTTP API** provides specific endpoints for exporting alerting resources in YAML or JSON, facilitating [provisioning via configuration files](ref:alerting_file_provisioning), or Terraform (HCL).

| Resource                 | Method / URI                                                         | Summary                                                                                      |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Alert rules              | GET /api/v1/provisioning/alert-rules/export                          | [Export all alert rules in provisioning file format](ref:export_rules).                      |
| Alert rules              | GET /api/v1/provisioning/folder/:folderUid/rule-groups/:group/export | [Export an alert rule group in provisioning file format](ref:export_rule_group).             |
| Alert rules              | GET /api/v1/provisioning/alert-rules/:uid/export                     | [Export an alert rule in provisioning file format](ref:export_rule).                         |
| Contact points           | GET /api/v1/provisioning/contact-points/export                       | [Export all contact points in provisioning file format](ref:export_contacts).                |
| Notification policy tree | GET /api/v1/provisioning/policies/export                             | [Export the notification policy tree in provisioning file format](ref:export_notifications). |
| Mute timings             | GET /api/v1/provisioning/mute-timings/export                         | [Export all mute timings in provisioning file format](ref:export_mute_timings).              |
| Mute timings             | GET /api/v1/provisioning/mute-timings/:name/export                   | [Export a mute timing in provisioning file format](ref:export_mute_timing).                  |

These endpoints accept a `download` parameter to download a file containing the exported resources.

<!-- prettier-ignore-start -->


<!-- prettier-ignore-end -->
