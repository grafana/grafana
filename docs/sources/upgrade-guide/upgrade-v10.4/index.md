---
description: Guide for upgrading to Grafana v10.4
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '10.4'
title: Upgrade to Grafana v10.4
menuTitle: Upgrade to v10.4
weight: 1300
---

# Upgrade to Grafana v10.4

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Technical notes

### Legacy alerting -> unified alerting dry-run on start

In preparation for the removal of Legacy alerting in v11, Grafana will initiate a dry-run of the upgrade from legacy alerting to unified alerting on every startup if an instance is not already upgraded. This operation will log the outcomes of the upgrade attempt and identify any issues requiring attention before the actual upgrade can be successfully executed. No changes will be made during the dry-run.

You can disable this behaviour using the feature flag `alertingUpgradeDryrunOnStart`:

```toml
[feature_toggles]
alertingUpgradeDryrunOnStart=false
```

{{% admonition type="note" %}}
We strongly encourage you to review the [upgrade guide](https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts/) and perform the necessary upgrade steps prior to v11.
{{% /admonition %}}
