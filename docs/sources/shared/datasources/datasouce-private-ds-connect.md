---
headless: true
labels:
  products:
    - enterprise
    - oss
---

[//]: # 'This file documents the Private data source section for data sources.'
[//]: # 'This shared file is included in these locations:'
[//]: # '/grafana/docs/sources/datasources/pyroscope/configure-pyroscope-data-source.md'
[//]: # '/grafana/docs/sources/datasources/tempo/configure-tempo-data-source.md'
[//]: # 'If you make changes to this file, verify that the meaning and content are not changed in any place where the file is included.'
[//]: # 'Any links should be fully qualified and not relative: /docs/grafana/ instead of ../grafana/.'

<!-- Procedure for using private data source connect section in the data sources -->

This feature is only available in Grafana Cloud.

This option lets you query data that lives within a secured network without opening the network to inbound traffic from Grafana Cloud.

Use the drop-down box to select a configured private data source.

Select **Manage private data source connect** to configure and manage any private data sources you have configured.

For more information, refer to [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).
