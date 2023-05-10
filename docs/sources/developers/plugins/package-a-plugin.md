---
description: How to package a plugin
title: Package a plugin
---

By packaging a plugin, you can organize the plugin code and make it ready for use in your organization.

## Package a plugin for distribution

1. Build the plugin

   ```
   yarn install --pure-lockfile
   yarn build
   ```

1. Optional: If your data source plugin has a backend plugin, build it as well.

   ```
   mage
   ```

   Make sure that all the binaries are executable and have a `0755` (`-rwxr-xr-x`) permission.

1. Sign the plugin. To learn more, refer to [Sign the plugin]({{< relref "./sign-a-plugin" >}}).

1. Rename the `dist` directory to match your plugin ID, and then create a ZIP archive.

   ```
   mv dist/ myorg-simple-panel
   zip myorg-simple-panel-1.0.0.zip myorg-simple-panel -r
   ```

1. Optional: Verify that your plugin is packaged correctly using [zipinfo](https://linux.die.net/man/1/zipinfo).
   It should look like this:

```
zipinfo grafana-clickhouse-datasource-1.1.2.zip

Archive:  grafana-clickhouse-datasource-1.1.2.zip
Zip file size: 34324077 bytes, number of entries: 22
drwxr-xr-x          0 bx stor 22-Mar-24 23:23 grafana-clickhouse-datasource/
-rw-r--r--       1654 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/CHANGELOG.md
-rw-r--r--      11357 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/LICENSE
-rw-r--r--       2468 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/MANIFEST.txt
-rw-r--r--       8678 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/README.md
drwxr-xr-x          0 bx stor 22-Mar-24 23:23 grafana-clickhouse-datasource/dashboards/
-rw-r--r--      42973 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/dashboards/cluster-analysis.json
-rw-r--r--      56759 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/dashboards/data-analysis.json
-rw-r--r--      39406 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/dashboards/query-analysis.json
-rwxr-xr-x   16469136 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/gpx_clickhouse_darwin_amd64
-rwxr-xr-x   16397666 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/gpx_clickhouse_darwin_arm64
-rwxr-xr-x   14942208 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/gpx_clickhouse_linux_amd64
-rwxr-xr-x   14155776 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/gpx_clickhouse_linux_arm
-rwxr-xr-x   14548992 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/gpx_clickhouse_linux_arm64
-rwxr-xr-x   15209472 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/gpx_clickhouse_windows_amd64.exe
drwxr-xr-x          0 bx stor 22-Mar-24 23:23 grafana-clickhouse-datasource/img/
-rw-r--r--        304 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/img/logo.png
-rw-r--r--       1587 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/img/logo.svg
-rw-r--r--     138400 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/module.js
-rw-r--r--        808 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/module.js.LICENSE.txt
-rw-r--r--     487395 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/module.js.map
-rw-r--r--       1616 bX defN 22-Mar-24 23:23 grafana-clickhouse-datasource/plugin.json
22 files, 92516655 bytes uncompressed, 34319591 bytes compressed:  62.9%
```

When you've packaged your plugin, you can proceed to [publishing a plugin]({{< relref "publish-a-plugin.md" >}}) or [installing a packaged plugin](https://grafana.com/docs/grafana/latest/administration/plugin-management/#install-a-packaged-plugin).
