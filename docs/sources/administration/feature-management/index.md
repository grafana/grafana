---
description: Describes how admin users can manage feature toggles
keywords:
  - feature
  - toggle
labels:
  products:
    - enterprise
    - oss
title: Feature Toggles Management
weight: 900
menuTitle: Feature Management
---

# Feature Toggles

Grafana incorporates feature toggles, enabling the introduction of new functionalities safeguarded by a control flag. This allows Grafana administrators the flexibility to determine the appropriate timing for enabling or disabling specific features.
For detailed insights into particular features and how they operate, please consult [Configure Feature Toggles](/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/").

## Manage Feature Toggles

In the Administration page, the Feature Management section enables administrators to see and switch the various features active in their Grafana environment. Based on the development stage of the feature, we establish specific options for visibility and customization.

| Stage                | Visibility | Editable |
| -------------------- | ---------- | -------- |
| Experimental         | Hidden     | No       |
| PrivatePreview       | Visible\*  | No       |
| Public Preview       | Visible\*  | No       |
| General Availability | Visible\*  | Yes\*    |

**Note:** Options marked with an asterisk (\*) are defaults for the corresponding feature stage. Each feature toggle owner can override its default behaviour.

## Edit Feature Toggles State

Editing feature toggles is only allowed if Grafana is configured with the proper feature management settings, see [Configure Feature Management](/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/#configure-feature-management").

Altering the state of a toggle may require restarting your Grafana instance, a process that could take a few minutes to complete.

**To edit a feature toggle:**

1. Sign in to Grafana as a server administrator.
2. Click **Administration** in the left-side menu, **General**, and then **Feature Toggles**.
3. Navigate the list of feature toggles and select your feature state overrides.
4. Click **Save changes** and wait for your Grafana instance to restart with the updated feature toggles.
