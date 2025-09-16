---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/migrate-recorded-queries/
description: Learn how to migrate your depreciated recorded queries to Grafana-managed recording rules.
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - recording rules
  - recorded queries
  - configure
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Migrate recorded queries
weight: 402
---

# Migrate recorded queries

Users can transpose their [now-depreciated recorded queries](/docs/grafana/latest/administration/recorded-queries/) into Grafana-managed recording rules in a few easy steps. The query PromQL for each recorded query has been exposed on the recorded queries list along with the existing datasource, time range, and interval values to simplify the migration process.

## Migrate your recorded queries to Grafana-managed alert rules

1. Navigate to **Administration** -> **Plugins and Data** -> **Recorded queries.**

1. Note the data source, query PromQL, interval, and time range, and copy them somewhere accessible.

   {{< figure alt="Example of relevant recorded query information"  src="/media/docs/alerting/rec-query-example.png" max-width="800px" >}}

1. Now navigate to **Alerting** -> **Alert rules.**

1. At the top of the Alert rules page, click **More** -> **New Grafana recording rule**.

   Add a name for your Recording Rule and a name for the new metric that the recording rule generates.

1. Select your data source and paste your ratio query PromQL into the query builder.

   Click **Options** and validate that the Time Range is the same as your recorded query.

1. Select the Folder you would like the rule to be created in.

1. Add any labels to the rule.

1. Select or create an evaluation group. Set your evaluation group’s evaluation interval to the interval of your recorded query.

1. Review your rule and click Save **rule and exit** when you are finished.

1. Update any areas where the recorded query was referenced to use the new Grafana-managed recording rule.
