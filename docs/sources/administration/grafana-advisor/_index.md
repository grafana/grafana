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

{{< youtube id="o84EfY-KP-c" >}}

## Use Grafana Advisor

### Access the Grafana Advisor UI

1. Log in to your Grafana instance with an **administrator account**.
1. Navigate to the Administration section.
1. Select "Advisor" from the left navigation menu.

### Action needed section

This collapsible section displays issues requiring immediate attention:

- For each item, Grafana Advisor displays the specific name of the item that needs to be fixed.
- For data source issues, Grafana Advisor displays the specific data source name.
- One or more buttons appear. These buttons point you to different links to fix the issue, retry the check or hide the error.

![Action needed](/media/docs/grafana-advisor/action_needed.png)

### Investigation needed section

This collapsible section provides information on issues that may not require immediate action but require your attention. For example, it provides information on plugins that require an upgrade. Similar to the "Action needed" section, clicking an item opens the plugin's upgrade page. From there, you can either update to the latest version or select a specific version from the version history tab.

![Investigation needed](/media/docs/grafana-advisor/investigation-needed.png)

### More info section

This collapsible section provides more details about which checks have been performed and how many items have been analyzed.

![<Grafana Advisor - More info tab>](/media/docs/grafana-advisor/more_info.png)

{{< admonition type="tip" >}}
Click the cogwheel in this section to access Grafana Advisor settings, where you can enable or disable checks according to your preferences.
{{< /admonition >}}

### Enable LLM suggestions 

TBD REMOVE?

If the [Grafana LLM app](https://grafana.com/grafana/plugins/grafana-llm-app/) is installed, the Advisor can use it to generate suggestions for issues. Enable the LLM app and click the magic (✨) button to generate a suggestion for an issue.

![<Grafana Advisor - LLM suggestions>](/media/docs/grafana-advisor/llm-suggestions.png)

## Address issues detected by Grafana Advisor

To resolve issues flagged by Grafana Advisor and maintain system reliability, follow the best practices below. Regularly check the Advisor to keep your Grafana instance secure and up to date.

- **Regular Monitoring:** Check the Advisor page often to identify and address emerging issues
- **Immediate Action:** Address "Action needed" items promptly to ensure system reliability
- **Systematic Review:** After fixing flagged issues, use the "Refresh" button to confirm all checks pass
- **Proactive Updates:** Address plugin update recommendations under "Investigation needed" even if they haven't caused failures yet

## Use Grafana Advisor with Grafana Assistant

TBC

