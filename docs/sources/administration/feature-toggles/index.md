---
description: Learn how authorized users can manage feature toggles
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

Grafana incorporates feature toggles which let you introduce new functionality safeguarded by control flags. This allows Grafana administrators the flexibility to determine the appropriate timing for enabling or disabling specific features.
For detailed information about particular features and how they operate, refer to [Configure Feature Toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

## Manage feature toggles

In the **Administration** page, the **Feature Management** section enables authorized users to view and edit the various features that are active in their Grafana environment.
Authorized users include administrators, and users with the [fixed roles](../roles-and-permissions/access-control/#fixed-roles) `featuremgmt.read` and `featuremgmt.write`.

There are different options for visibility and customization depending on the development stage of the feature.

| Stage                | Visibility | Editable |
| -------------------- | ---------- | -------- |
| Experimental         | Hidden     | No       |
| Private preview      | Hidden     | No       |
| Public preview       | Visible\*  | No       |
| General availability | Visible\*  | Yes\*    |
| Deprecated           | Visible\*  | Yes\*    |

{{< admonition type="note" >}}
Options marked with an asterisk (\*) are defaults for the corresponding feature stage.
Each feature toggle owner can override its default behavior.
{{< /admonition >}}

## Edit feature toggles

You can only edit feature toggles if Grafana is configured with the proper feature management settings.
For more information, refer to [Configure feature management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#configure-feature-management).

Altering the state of a toggle may require restarting your Grafana instance, which can take a few minutes.

To edit a feature toggle, follow these steps:

1. Sign in to Grafana as a server administrator or authorized user.
1. In the primary menu, go to **Administration > General > Feature toggles**.
1. Navigate to the list of feature toggles and select your feature state overrides.
1. Click **Save changes** and wait for your Grafana instance to restart with the updated feature toggles.

{{< admonition type="note" >}}
If you don't have the feature toggle management page, enable the `featureToggleAdminPage` feature toggle.

Editing feature toggles with the feature toggle management page is available now in all tiers of [Grafana Cloud](/docs/grafana-cloud/).
{{< /admonition >}}
