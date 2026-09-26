---
headless: true
labels:
  products:
    - cloud
    - enterprise
    - oss
---

[//]: # 'Shared note: querying a data source with the gcx Grafana CLI.'
[//]: # 'This shared file is included in these locations:'
[//]: # '/docs/sources/datasources/pyroscope/_index.md'
[//]: #
[//]: # 'If you make changes to this file, verify that the meaning and content are not changed in any place where the file is included.'
[//]: # 'Any links should be fully qualified and not relative: /docs/grafana/ instead of ../grafana/.'

## Query with the Grafana CLI

You can query this data source from the command line and from AI coding agents using the Grafana CLI, `gcx`. `gcx` gives you and your agent structured, terminal-based access to your Grafana data sources, which is useful for automation and agent-driven investigations.

`gcx` supports Grafana Cloud and Grafana OSS or Enterprise v12 and later. Before you query, install and authenticate `gcx`. Refer to the [`gcx` CLI documentation](/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/gcx/) for installation, configuration, and the full command reference.
