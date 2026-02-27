---
title: Manage Advisor with Grafana CLI
description: Manage Grafana Advisor using the Grafana CLI
weight: 100
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
  - CLI
  - grafanactl
---

# Manage Grafana Advisor using the Grafana CLI

{{< admonition type="note" >}}
Grafana Advisor is available in [public preview](https://grafana.com/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

Currently, Grafana Advisor performs regular checks on data sources, plugins, and your Grafana instance, but we're planning to expand its capabilities in future releases to cover more aspects of your Grafana environment. You can suggest new checks and provide feedback through this [form](https://docs.google.com/forms/d/e/1FAIpQLSf8T-xMZauFXZ1uHw09OjZLT_AaiY-cl-hJGwC6Krkj0ThmZQ/viewform).
{{< /admonition >}}

`grafanactl`, the Grafana CLI tool, is a command-line tool for managing Grafana resources as code. To install and configure it, refer to the [Grafana CLI documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/).

You can use `grafanactl` to manage Advisor `checks` and `checktypes`.

## Get the list of checks

To get the list of checks, run:

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

## Get the list of check types

To obtain the list of check types:

```bash
grafanactl resources get checktypes -o wide
```

## Show all failures across every check type

To see all failures in your instance:

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

## Run checks for a type

To run checks for a specific type, create the check resource and push it:

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

Next, wait for the check to run and the results to be available:

```bash
grafanactl resources get checks/check-manual -o json | jq '.status.report'
```

## Get plugins that need an update

To identify the plugins that need an update:

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

## Unhealthy data sources

To look for unhealthy data sources:

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
