+++
title = "Alert groups"
description = "Alert groups"
keywords = ["grafana", "alerting", "alerts", "groups"]
weight = 400
+++

# View alert groups

Alert groups shows grouped alerts from an alertmanager instance. Alertmanager will group alerts based on common label values. This prevents duplicate alerts from being fired by grouping common alerts into a single alert group. By default, the alerts are grouped by the label keys for the root policy in [notification policies]({{< relref "./notification-policies.md" >}}).

## Show alert groups for an external Alertmanager

Grafana alerting UI supports alert groups from external Alertmanager data sources. Once you add an [Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}), a dropdown displays at the top of the page where you can select either `Grafana` or an external Alertmanager as your data source.

## View different alert groupings

To view a grouping other than the default use the **custom group by** dropdown to select combinations of labels to group alerts by. This is useful for debugging and verifying your notification policies grouping.

If an alert does not contain labels specified in the grouping of the route policy or the custom grouping it will be added to a catch all group with a header of `No grouping`.

## Filter alerts

You can use the following filters to view only alerts that match specific criteria:

- **Filter alerts by label -** Search by alert labels using label selectors in the **Search** input. eg: `environment=production,region=~US|EU,severity!=warning`
- **Filter alerts by state -** In **States** Select which alert states you want to see. All others are hidden.
