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

The export options listed below enable you to download resources in YAML, JSON, or Terraform format, facilitating their provisioning through [configuration files][alerting_file_provisioning] or [Terraform][alerting_tf_provisioning].

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

### Export contact points

To export contact points from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Contact points**.
1. Find the contact point you want to export and click **More** -> **Export**.
1. Choose the format to export in.

   The exported contact point appears in different formats - YAML, JSON, Terraform.

1. Click **Copy Code** or **Download**.

### Export templates

Grafana currently doesn't offer an Export UI or [Export endpoint](#export-api-endpoints) for notification templates, unlike other Alerting resources presented in this documentation.

However, you can export it by manually copying the content template and title directly from the Grafana UI.

1. Click **Alerts & IRM** -> **Contact points** -> **Notification templates** tab.
1. Find the template you want to export.
1. Copy the content and title.
1. Adjust it for the [file provisioning format][alerting_file_provisioning_template] or [Terraform resource][alerting_tf_provisioning_template].

### Export the notification policy tree

All notification policies are provisioned through a single resource: the root of the notification policy tree.

{{% admonition type="warning" %}}

Since the policy tree is a single resource, provisioning it will overwrite a policy tree created through any other means.

{{< /admonition >}}

To export the notification policy tree from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Notification policies**.
1. In the **Default notification policy** section, click **...** -> **Export**.
1. Choose the format to export in.

   The exported contact point appears in different formats - YAML, JSON, Terraform.

1. Click **Copy Code** or **Download**.

### Export mute timings

To export mute timings from the Grafana UI, complete the following steps.

1. Click **Alerts & IRM** -> **Notification policies**, and then the **Mute timings** tab.
1. Find the mute timing you want to export and click **Export**.
1. Choose the format to export in.

   The exported contact point appears in different formats - YAML, JSON, Terraform.

1. Click **Copy Code** or **Download**.

## HTTP Alerting API

You can use the [Alerting HTTP API][alerting_http_provisioning] to return existing alerting resources in JSON and import them to another Grafana instance using the same endpoint.

| Resource                                                       | URI                                 |
| -------------------------------------------------------------- | ----------------------------------- |
| [Alert rules][alerting_http_alertrules]                        | /api/v1/provisioning/alert-rules    |
| [Contact points][alerting_http_contactpoints]                  | /api/v1/provisioning/contact-points |
| [Notification policy tree][alerting_http_notificationpolicies] | /api/v1/provisioning/policies       |
| [Mute timings][alerting_http_mutetimings]                      | /api/v1/provisioning/mute-timings   |
| [Templates][alerting_http_templates]                           | /api/v1/provisioning/templates      |

However, note the standard endpoints return a JSON format that is not compatible for provisioning through configuration files or Terraform, except the `/export` endpoints listed below.

### Export API endpoints

The **Alerting HTTP API** provides specific endpoints for exporting alerting resources in YAML or JSON formats, facilitating [provisioning via configuration files][alerting_file_provisioning]. Currently, Terraform format is not supported.

| Resource                 | Method / URI                                                         | Summary                                                                                  |
| ------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Alert rules              | GET /api/v1/provisioning/alert-rules/export                          | [Export all alert rules in provisioning file format.][export_rules]                      |
| Alert rules              | GET /api/v1/provisioning/folder/:folderUid/rule-groups/:group/export | [Export an alert rule group in provisioning file format.][export_rule_group]             |
| Alert rules              | GET /api/v1/provisioning/alert-rules/:uid/export                     | [Export an alert rule in provisioning file format.][export_rule]                         |
| Contact points           | GET /api/v1/provisioning/contact-points/export                       | [Export all contact points in provisioning file format.][export_contacts]                |
| Notification policy tree | GET /api/v1/provisioning/policies/export                             | [Export the notification policy tree in provisioning file format.][export_notifications] |
| Mute timings             | GET /api/v1/provisioning/mute-timings/export                         | [Export all mute timings in provisioning file format.][export_mute_timings]              |
| Mute timings             | GET /api/v1/provisioning/mute-timings/:name/export                   | [Export a mute timing in provisioning file format.][export_mute_timing]                  |

These endpoints accept a `download` parameter to download a file containing the exported resources.

<!-- prettier-ignore-start -->

{{% docs/reference %}}

[alerting_http_alertrules]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#alert-rules"
[alerting_http_alertrules]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning#alert-rules"

[alerting_http_contactpoints]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#contact-points"
[alerting_http_contactpoints]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning#contact-points"

[alerting_http_notificationpolicies]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#notification-policies"
[alerting_http_notificationpolicies]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning#notification-policies"

[alerting_http_mutetimings]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#mute-timings"
[alerting_http_mutetimings]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning#mute-timings"

[alerting_http_templates]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#templates"
[alerting_http_templates]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning#templates"

[alerting_tf_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning"
[alerting_tf_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning"

[alerting_tf_provisioning_template]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning#import-contact-points-and-templates"
[alerting_tf_provisioning_template]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning#import-contact-points-and-templates"

[alerting_http_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning"
[alerting_http_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning"

[alerting_file_provisioning]: "/docs/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning"

[alerting_file_provisioning_template]: "/docs/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning#import-templates"

[export_rule]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-alert-rule-exportspan-export-an-alert-rule-in-provisioning-file-format-_routegetalertruleexport_"
[export_rule]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-alert-rule-exportspan-export-an-alert-rule-in-provisioning-file-format-_routegetalertruleexport_"

[export_rule_group]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-alert-rule-group-exportspan-export-an-alert-rule-group-in-provisioning-file-format-_routegetalertrulegroupexport_"
[export_rule_group]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-alert-rule-group-exportspan-export-an-alert-rule-group-in-provisioning-file-format-_routegetalertrulegroupexport_"

[export_rules]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-alert-rules-exportspan-export-all-alert-rules-in-provisioning-file-format-_routegetalertrulesexport_"
[export_rules]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-alert-rules-exportspan-export-all-alert-rules-in-provisioning-file-format-_routegetalertrulesexport_"

[export_contacts]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-contactpoints-exportspan-export-all-contact-points-in-provisioning-file-format-_routegetcontactpointsexport_"
[export_contacts]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-contactpoints-exportspan-export-all-contact-points-in-provisioning-file-format-_routegetcontactpointsexport_"

[export_mute_timing]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-mute-timing-exportspan-export-a-mute-timing-in-provisioning-file-format-_routegetmutetimingexport_"
[export_mute_timing]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-mute-timing-exportspan-export-a-mute-timing-in-provisioning-file-format-_routegetmutetimingexport_"

[export_mute_timings]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-mute-timings-exportspan-export-all-mute-timings-in-provisioning-file-format-_routegetmutetimingsexport_"
[export_mute_timings]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-mute-timings-exportspan-export-all-mute-timings-in-provisioning-file-format-_routegetmutetimingsexport_"

[export_notifications]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-policy-tree-exportspan-export-the-notification-policy-tree-in-provisioning-file-format-_routegetpolicytreeexport_"
[export_notifications]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning#span-idroute-get-policy-tree-exportspan-export-the-notification-policy-tree-in-provisioning-file-format-_routegetpolicytreeexport_"
{{% /docs/reference %}}

<!-- prettier-ignore-end -->
