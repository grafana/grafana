---
aliases:
  - /docs/grafana-cloud/alerts/grafana-cloud-alerting/silences/
  - /docs/grafana-cloud/how-do-i/grafana-cloud-alerting/silences/
  - /docs/grafana-cloud/legacy-alerting/grafana-cloud-alerting/silences/
description: Silences
title: Silences
weight: 600
---

# Silences

Grafana Cloud Alerting allows you to manage silences for your alertmanager notifications directly inside of Grafana. This applies to alerting rules created for both Prometheus metrics and Loki logs.

## Create a silence

1. In Grafana, hover your cursor over the **Grafana Cloud Alerting** icon and then click **Silences**.
2. Click **New silence**.
3. Enter a date in **Start of silence** to indicate when the silence should go into effect.
4. Enter a date in **End of silence** to indicate when the silence should expire.
5. Enter one or more matchers by filling out the **Name** and **Value** fields. Matchers determine which rules the silence will apply to.
6. Enter the name of the owner in **Creator**.
7. Enter a **Comment**.
8. To view which rules will be affected by your silence, click **Preview alerts**.
9. Otherwise, when you are finished, click **Create**

## Update an existing silence

You can always update an existing silence by clicking the **Edit silence** button under the silence.

It is also possible to expire a silence, on-demand, by clicking the **Expire silence** button under the silence. This will override the original scheduled expiration date of the silence.
