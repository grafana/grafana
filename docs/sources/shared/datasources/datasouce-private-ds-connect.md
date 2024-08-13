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

{{< admonition type="note" >}}
This feature is only available in Grafana Cloud.
{{< /admonition >}}

Use private data source connect (PDC) to connect to and query data within a secure network without opening that network to inbound traffic from Grafana Cloud.

Refer to [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) for more information on how PDC works and [Configure Grafana private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc) for steps on setting up a PDC connection.

Use the drop-down list to select a configured private data source. If you make changes, select **Test & save** to preserve your changes.

Use **Manage private data source connect** to configure and manage any private data sources you have configured.
