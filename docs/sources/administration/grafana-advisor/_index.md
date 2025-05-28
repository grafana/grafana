---
title: Grafana Advisor
description: Learn more about Grafana Advisor, the app to monitor the health of your Grafana instance
weight: 300
labels:
  products:
    - oss
    - cloud
    - enterprise
  stage: experimental
keywords:
  - grafana
  - grafana advisor
  - monitoring
  - instance health
---

# Grafana Advisor

{{< docs/experimental product="Grafana Advisor" featureFlag="grafanaAdvisor" >}}

## Overview

Grafana Advisor is a monitoring tool that helps administrators keep their Grafana instances running smoothly and securely. It automatically performs regular health checks on your Grafana server, providing actionable insights and recommendations for maintaining optimal system performance.

{{< admonition type="note" >}}
Currently, Grafana Advisor only performs regular health checks on data sources, plugins, and your SSO settings, but we're planning to expand its capabilities in future releases to cover more aspects of your Grafana environment.

You can suggest new checks and provide feedback through this [form](https://docs.google.com/forms/d/e/1FAIpQLSf8T-xMZauFXZ1uHw09OjZLT_AaiY-cl-hJGwC6Krkj0ThmZQ/viewform).
{{< /admonition >}}

## Before you begin

To set up Grafana Advisor you need:

- Administration rights in your Grafana organization.
- If you're running Grafana on-premise, enable the required feature toggles in your Grafana instance. Refer to [Enable required feature toggles](#enable-feature-toggles) for instructions. This is not required if you're using Grafana Cloud, as the feature toggles are enabled by default.

### Enable feature toggles

To activate Grafana Advisor, you need to enable the `grafanaAdvisor` feature toggle. This will automatically install the Grafana Advisor application to your server if it is not already installed. For additional information about feature toggles, refer to [Configure feature toggles](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/).

To enable the required feature toggles, add them to your Grafana configuration file:

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`. For file location based on the operating system, refer to Configuration file location.
1. Locate or add a `[feature_toggles]` section. Add this value:

   ```ini
   [feature_toggles]
   grafanaAdvisor = true
   ```

1. Save the changes to the file and restart Grafana.

## Access Grafana Advisor

1. Log in to your Grafana instance with an administrator account
1. Navigate to the Administration section
1. Select "Advisor" from the navigation menu

![<Grafana Advisor UI>](/media/docs/grafana-advisor/grafana-advisor-ui.png)

## Understand the Advisor interface

### Action needed section

This collapsible section displays issues requiring immediate attention:

- Each issue is listed with descriptive text outlining the problem
- For data source issues, Grafana Advisor displays the specific data source name.
- A "Fix me" button appears. This button points you to the relevant issues to fix

![Action needed](/media/docs/grafana-advisor/action_needed.png)

### Investigation needed section

This collapsible section provides information on plugins that require an upgrade. Clicking an item opens the plugin's upgrade page. From there, you can either update to the latest version or select a specific version from the version history tab.

![Investigation needed](/media/docs/grafana-advisor/investigation-needed.png)

### More info section

This collapsible section provides details about the checks performed:

**Data source checks**

- Shows the number of data sources analyzed
- UID validation: Checks if the UID of each data source is valid
- Health check: Verifies if data sources are responding properly
- Missing plugin check: Verifies that each data source has its associated plugin installed

**Plugin Checks**

- Shows the number of plugins analyzed (for example, "X plugin(s) analyzed")
- Deprecation check: Identifies any installed plugins that are deprecated
- Update check: Detects if any installed plugins have newer versions available

**SSO Checks**

- Checks if the list configurations in SSO settings are in a valid list format (space-separated, comma-separated, or JSON array).

![<Grafana Advisor - More info tab>](/media/docs/grafana-advisor/more_info.png)

{{< admonition type="tip" >}}
Click the cogwheel in this section to access Grafana Advisor settings.
{{< /admonition >}}

## Address issues

To resolve issues flagged by Grafana Advisor and maintain system reliability, follow the best practices below. Regularly check the Advisor to keep your Grafana instance secure and up to date.

### Best practices

- **Regular Monitoring:** Check the Advisor page often to identify and address emerging issues
- **Immediate Action:** Address "Action needed" items promptly to ensure system reliability
- **Systematic Review:** After fixing flagged issues, use the "Refresh" button to confirm all checks pass
- **Proactive Updates:** Address plugin update recommendations under "Investigation needed" even if they haven't caused failures yet

## Types of checks performed

| **Check type**           | **Purpose**                           | **What's verified**                                                                                                 | **Remediation**                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UID validation**       | Ensure proper data source identifiers | Checks if the UID of a data source is valid. <br> This check is performed only in data sources with a backend.      | <ul><li>Follow the instructions listed [here](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.2/#what-do-i-do-if-im-affected) </ul>.                                                                                                                                                                                                                               |
| **Health check**         | Verify data source connectivity       | Checks if a data source is healthy and responding.<br> This check is performed only in data sources with a backend. | <ul><li> Click "Fix me" to navigate to the data source instance <li> Click "Save and Test" to review the error message for the data source <li> Update the configuration to remediate the error. For example, it may be that the URL is incorrect or a token has expired and needs to be replaced</ul>                                                                                          |
| **Missing plugin check** | Confirm required plugins are present  | Checks if the plugin associated with the data source is installed                                                   | <ul><li>Review the list of data sources. Orphaned instances which are no longer required can be deleted via this list <li>If the corresponding plugin is available in the catalog, click "Install plugin" to navigate to the plugin details page and then click "Install"</ul>                                                                                                                  |
| **Deprecation check**    | Identify outdated components          | Checks if any installed plugins are deprecated                                                                      | <ul><li>If a plugin has been deprecated, it means it's no longer going to receive updates and you should plan to migrate to an alternative <li>Navigate to the plugin details page to review the deprecation notice which may include guidance on alternatives <li>If none are specified, review the [plugins catalog](https://grafana.com/grafana/plugins/) to discover potential options</ul> |
| **Update check**         | Keep plugins current                  | Checks if an installed plugin has a newer version available                                                         | <ul><li>We strongly recommend running the latest version of plugins <li> Click "Upgrade" to navigate to the plugin details page and either select "Update" to move to the latest version, or choose a specific version of the plugin within the version history tab</ul>                                                                                                                        |
