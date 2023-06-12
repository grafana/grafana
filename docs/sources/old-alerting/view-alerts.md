---
aliases:
  - ../alerting/view-alerts/
description: View existing alert rules
draft: true
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - view
title: View existing alert rules
menuTitle: View alerts
weight: 400
---

# View existing alert rules

Grafana stores individual alert rules in the panels where they are defined, but you can also view a list of all existing alert rules and their current state.

In the Grafana side bar, hover your cursor over the Alerting (bell) icon and then click **Alert Rules**. All configured alert rules are listed, along with their current state.

You can do several things while viewing alerts.

- **Filter alerts by name -** Type an alert name in the **Search alerts** field.
- **Filter alerts by state -** In **States**, select which alert states you want to see. All others will be hidden.
- **Pause or resume an alert -** Click the **Pause** or **Play** icon next to the alert to pause or resume evaluation. See [Pause an alert rule]({{< relref "./pause-an-alert-rule" >}}) for more information.
- **Access alert rule settings -** Click the alert name or the **Edit alert rule** (gear) icon. Grafana opens the Alert tab of the panel where the alert rule is defined. This is helpful when an alert is firing but you don't know which panel it is defined in.
