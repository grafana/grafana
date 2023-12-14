---
description: Describes how admin users can manage feature toggles
keywords:
  - feature
  - toggle
labels:
  products:
    - enterprise
    - oss
title: Feature toggles
weight: 900
---

# Feature toggles

Grafana incorporates feature toggles, enabling the introduction of new functionalities safeguarded by a control flag. This allows Grafana administrators the flexibility to determine the appropriate timing for enabling or disabling specific features.
For detailed information about particular features and how they operate, refer to [Configure Feature Toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

## Manage feature toggles

In the **Administration** page, the **Feature Management** section enables administrators to see and edit the various features that are active in their Grafana environment.
There are different options for visibility and customization depending on the development stage of the feature.

| Stage                | Visibility | Editable |
| -------------------- | ---------- | -------- |
| Experimental         | Hidden     | No       |
| Private preview      | Visible\*  | No       |
| Public preview       | Visible\*  | No       |
| General availability | Visible\*  | Yes\*    |

{{< admonition type="note" >}}
Options marked with an asterisk (\*) are defaults for the corresponding feature stage.
Each feature toggle owner can override its default behavior.
{{< /admonition >}}

## Edit feature toggles

You can only edit feature toggles if Grafana is configured with the proper feature management settings.
For more information, refer to [Configure feature management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#configure-feature-management).

Altering the state of a toggle may require restarting your Grafana instance, a process that could take a few minutes to complete.

To edit a feature toggle, follow these steps:

1. Sign in to Grafana as a server administrator.
1. Click **Administration** in the left-side menu, **General**, and then **Feature toggles**.
1. Navigate to the list of feature toggles and select your feature state overrides.
1. Click **Save changes** and wait for your Grafana instance to restart with the updated feature toggles.
