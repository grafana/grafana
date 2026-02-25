---
title: Grafana Advisor
description: Learn more about Grafana Advisor, the app to monitor the health of your Grafana instance
weight: 700
labels:
  products:
    - oss
    - cloud
    - enterprise
keywords:
  - grafana
  - grafana advisor
  - monitoring
  - instance health
---

# Grafana Advisor

Grafana Advisor is a monitoring tool that helps administrators keep their Grafana instances running smoothly and securely. It automatically performs regular health checks on your Grafana server, providing actionable insights and recommendations for maintaining optimal system performance.

{{< admonition type="note" >}}
Currently, Grafana Advisor performs regular checks on data sources, plugins, and your Grafana instance, but we're planning to expand its capabilities in future releases to cover more aspects of your Grafana environment.

You can suggest new checks and provide feedback through this [form](https://docs.google.com/forms/d/e/1FAIpQLSf8T-xMZauFXZ1uHw09OjZLT_AaiY-cl-hJGwC6Krkj0ThmZQ/viewform).
{{< /admonition >}}

TBD UPDATE VIDEO?

{{< youtube id="o84EfY-KP-c" >}}

To access the Grafana Advisor:

1. Log in to your Grafana instance with an **Administrator account**.
1. Navigate to the **Administration** section on the left navigation menu.
1. Click **Advisor**.
1. If you're a first time user, select **Generate report** to run Advisor and obtain your first report. From now on, reporting is automated and updated periodically.

## Navigate the Advisor report

An Advisor report can contain the following tasks and action suggestions:

- [Action needed](#action-needed)
- [Investigation needed](#investigation-needed)
- [No action needed](#no-action-needed)

![Action needed](/media/docs/grafana-advisor/advisor-g13.png)

{{< admonition type="note" >}}

You can configure which checks Advisor will run. See how in [Configure application](#advisor-menu).

{{< /admonition >}}

### Action needed

This collapsible section displays issues requiring immediate attention. For each item, Grafana Advisor displays the specific name of the item that needs to be fixed. For data source issues, Grafana Advisor displays the specific data source name.

For each item, one or more buttons appear:

- Fix the issue.
- The [Grafana Assistant](#use-grafana-advisor-with-grafana-assistant) sparkle icon.
- Retry the check.
- Hide the error. If you hide an error you can see it again by clicking the **Hide/Show silenced errors** eye icon on the top right corner.

### Investigation needed

This collapsible section provides information on issues that may not require immediate action but require your attention. For example, it provides information on plugins that require an upgrade. Similar to the **Action needed** section, clicking an item opens the plugin's upgrade page. From there, you can either update to the latest version or select a specific version from the version history tab.

### No action needed

This collapsible section provides more details about which checks have been performed and how many items have been analyzed. You can configure which checks Advisor will run. See how in [Advisor menu > Configure application](#advisor-menu).

### Use Grafana Advisor with Grafana Assistant

You can use Advisor with the Grafana Assistant, a purpose-built LLM in Grafana Cloud that allows you to troubleshoot incidents, manage resources, and answer product questions in minutes. The Assistant removes manual operations and speeds up response time. Strong privacy and security controls ensure conversations respect RBAC, route through vetted service providers, and rely on your telemetry to produce action-ready results.

To learn more, refer to the [Grafana Assistant documentation](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/).

## Advisor menu

On the top right corner of the Advisor UI you have the following options and settings:

- **Refresh** the report.
- **Configure application**. Click the cogwheel button to access Grafana Advisor plugin settings, where you can enable or disable checks according to your preferences. See below for [the list of available checks](#available-checks).
- **Hide/Show silenced issues**.
- **Delete reports**.

### Available checks

You can enable the following checks:

Configuration:

- Security config check

Data sources:

- UID validation
- Health check
- Missing plugin check
- Prometheus deprecated authentication check

Instance:

- Grafana Cloud version check

Plugin:

- Deprecation check
- Update check
- Plugin signature check

SSO settings:

- SSO List Setting format validation

## Address issues detected by Grafana Advisor

To maintain system reliability and keep your Grafana instance secure and up to date, regularly check the Advisor page to resolve issues flagged by Grafana Advisor:

- **Regular Monitoring:** Check the Advisor page often to identify and address emerging issues
- **Immediate Action:** Address "Action needed" items promptly to ensure system reliability
- **Systematic Review:** After fixing flagged issues, use the "Refresh" button to confirm all checks pass
- **Proactive Updates:** Address plugin update recommendations under "Investigation needed" even if they haven't caused failures yet
