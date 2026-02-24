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

![<Grafana Advisor UI>](/media/docs/grafana-advisor/grafana-advisor-ui.png)

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

If the [Grafana LLM app](https://grafana.com/grafana/plugins/grafana-llm-app/) is installed, the Advisor can use it to generate suggestions for issues. Enable the LLM app and click the magic (✨) button to generate a suggestion for an issue.

![<Grafana Advisor - LLM suggestions>](/media/docs/grafana-advisor/llm-suggestions.png)

## Address issues detected by Grafana Advisor

To resolve issues flagged by Grafana Advisor and maintain system reliability, follow the best practices below. Regularly check the Advisor to keep your Grafana instance secure and up to date.

- **Regular Monitoring:** Check the Advisor page often to identify and address emerging issues
- **Immediate Action:** Address "Action needed" items promptly to ensure system reliability
- **Systematic Review:** After fixing flagged issues, use the "Refresh" button to confirm all checks pass
- **Proactive Updates:** Address plugin update recommendations under "Investigation needed" even if they haven't caused failures yet

## Manage Advisor using the Grafana CLI `grafanactl`

The Grafana CLI `grafanactl` tool is a command-line tool for managing Grafana resources as code. See how to install and configure it in the [Grafana CLI](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/) documentation.

You can use `grafnactl` to manage Advisor `checks` and `checktypes`. Navigate the tabs to learn more.

{{< tabs >}}
{{< tab-content name="Get the list of checks" >}}

```bash
grafanactl resources get checks -o wide
```

For a more detailed view, you can get the list of elements checked and failing inspecting the JSON output:

```bash
grafanactl resources get checks -o json | jq -r '
  ["TYPE","CHECKED","FAILURES"],
  (
    [.items[] | {
      type: .metadata.labels["advisor.grafana.app/type"],
      ts: .metadata.creationTimestamp,
      count: (.status.report.count // 0),
      failures: ((.status.report.failures // []) | length)
    }]
    | group_by(.type)
    | map(sort_by(.ts) | last)
    | sort_by(.type)
    | .[]
    | [.type, (.count | tostring), (.failures | tostring)]
  )
  | @tsv
' | column -t -s $'\t'
```

{{< /tab-content >}}
{{< tab-content name="Get the list of check types" >}}

```bash
grafanactl resources get checktypes -o wide
```

{{< /tab-content >}}
{{< tab-content name="Show all failures across every check type" >}}

```bash
grafanactl resources get checks -o json | jq -r '
  ["SEVERITY","ITEM","RULE","TYPE"],
  (
    [.items[] | {
      type: .metadata.labels["advisor.grafana.app/type"],
      ts: .metadata.creationTimestamp,
      failures: (.status.report.failures // [])
    }]
    | group_by(.type)
    | map(sort_by(.ts) | last)
    | map(select((.failures | length) > 0))
    | .[]
    | .type as $t
    | .failures[]
    | [.severity, .item, .stepID, $t]
  )
  | @tsv
' | column -t -s $'\t'
```

{{< /tab-content >}}
{{< tab-content name="Run checks for a type" >}}

Create the check resource and push it:

```bash
mkdir -p resources/Check/
echo '{
  "kind":"Check",
  "metadata":{
    "name":"check-manual",
    "labels":{"advisor.grafana.app/type":"datasource"}, # Replace with the check type you want to run
    "namespace":"<namespace>" # Replace with the namespace of your Grafana instance or "default" for on-premise
  },
  "apiVersion":"advisor.grafana.app/v0alpha1",
  "spec":{"data":{}},
  "status":{
    "report":{
      "count":0,
      "failures":[]
    }
  }
}' > resources/Check/check-manual.json
grafanactl push checks/check-manual
```

Then wait for the check to run and the results to be available:

```bash
grafanactl resources get checks/check-manual -o json | jq '.status.report'
```

{{< /tab-content >}}
{{< tab-content name="Get plugins that need an update" >}}

```bash
grafanactl resources get checks -o json | jq -r '
  ["PLUGIN","SEVERITY","PLUGIN PATH"],
  (
    [.items[] | select(.metadata.labels["advisor.grafana.app/type"] == "plugin")]
    | sort_by(.metadata.creationTimestamp) | last
    | .status.report.failures[]?
    | select(.stepID == "update")
    | [.item, .severity, (.links[0].url // "-")]
  )
  | @tsv
' | column -t -s $'\t'
```

{{< /tab-content >}}
{{< tab-content name="Unhealthy datasources" >}}

```bash
grafanactl resources get checks -o json | jq -r '
  ["DATASOURCE","SEVERITY","DATASOURCE PATH"],
  (
    [.items[] | select(.metadata.labels["advisor.grafana.app/type"] == "datasource")]
    | sort_by(.metadata.creationTimestamp) | last
    | .status.report.failures[]?
    | select(.stepID == "health-check")
    | [.item, .severity, (.links[0].url // "-")]
  )
  | @tsv
' | column -t -s $'\t'
```

{{< /tab-content >}}
{{< /tabs >}}
