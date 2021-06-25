+++
title = "Export and import"
keywords = ["grafana", "dashboard", "documentation", "export", "import"]
aliases = ["/docs/grafana/latest/reference/export_import/"]
weight = 800
+++

# Export and import

Grafana Dashboards can easily be exported and imported, either from the UI or from the [HTTP API]({{< relref "../../http_api/dashboard.md#create-update-dashboard" >}}).

## Exporting a dashboard

Dashboards are exported in Grafana JSON format, and contain everything you need (layout, variables, styles, data sources, queries, etc) to import the dashboard at a later time.

The export feature is accessed in the share window which you open by clicking the share button in the dashboard menu.

{{< figure src="/static/img/docs/export/export-modal.png" max-width="800px" >}}

### Making a dashboard portable

If you want to export a dashboard for others to use then it could be a good idea to
add template variables for things like a metric prefix (use constant variable) and server name.

A template variable of the type `Constant` will automatically be hidden in
the dashboard, and will also be added as a required input when the dashboard is imported.

## Import dashboard

To import a dashboard click the + icon in the side menu, and then click **Import**.

{{< figure src="/static/img/docs/v70/import_step1.png" max-width="700px" >}}

From here you can upload a dashboard JSON file, paste a [Grafana.com](https://grafana.com) dashboard
URL or paste dashboard JSON text directly into the text area.

{{< figure src="/static/img/docs/v70/import_step2_grafana.com.png"  max-width="700px" >}}

In step 2 of the import process Grafana will let you change the name of the dashboard, pick what
data source you want the dashboard to use and specify any metric prefixes (if the dashboard use any).

## Discover dashboards on Grafana.com

Find dashboards for common server applications at [Grafana.com/dashboards](https://grafana.com/dashboards).

{{< figure src="/static/img/docs/v50/gcom_dashboard_list.png" max-width="700px" >}}

>**Note:** In Grafana v5.3.4 and later versions, the export modal has new checkbox for sharing for external use (other instances). If the checkbox is not checked then the `__inputs` section will not be included in the exported JSON file.
