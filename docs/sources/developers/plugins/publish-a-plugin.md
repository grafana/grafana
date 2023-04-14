---
aliases:
  - share-a-plugin/
  - package-a-plugin/
description: Learn how to package and share your plugin.
title: Publish a plugin
type: docs
---

# Publish a plugin

You've just built your first plugin, and now you want to share it with the world.
In this guide, you'll learn how to package and share your plugin with others.

For Grafana to be able to load a plugin, it first needs to be built.
When you build a plugin from source, a `dist` directory is created that contains the production build, or _plugin assets_, for your plugin.

When the Grafana server starts, it recursively looks in the plugin directory for any directory that contains a `plugin.json` file and tries to load the plugin assets in the same directory.

There are three steps needed to package a plugin:

- Building the plugin
- Signing the plugin
- Packaging the plugin

1. Build the plugin

   ```
   yarn install --pure-lockfile
   yarn build
   ```

1. (Optional) If your data source plugin has a backend plugin, build it as well.

   ```
   mage
   ```

   make sure that all the binaries are executable and have a `0755` (`-rwxr-xr-x`) permission

1. [Sign the plugin]({{< relref "./sign-a-plugin" >}}).

1. Rename `dist` directory to match your plugin id and create a ZIP archive

   ```
   mv dist/ myorg-simple-panel
   zip myorg-simple-panel-1.0.0.zip myorg-simple-panel -r
   ```

1. (Optional) Verify your plugin is packaged correctly using [zipinfo](https://linux.die.net/man/1/zipinfo).
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

## Publish your plugin on Grafana.com

The best way to share your plugin with the world is to publish it on [Grafana Plugins](/plugins).
By having your plugin published on Grafana.com, more users will be able to discover your plugin.

Before you submit your plugin, we ask that you read our guidelines and frequently asked questions.

### Guidelines

To speed up the time it takes to review your plugin:

- Get familiar with our plugin [publishing and signing criteria]({{< relref "./publishing-and-signing-criteria" >}})
- Check that your plugin is ready for review using the [plugin validator](https://github.com/grafana/plugin-validator).
- Read our [6 tips for improving your Grafana plugin before you publish](/blog/2021/01/21/6-tips-for-improving-your-grafana-plugin-before-you-publish/).
- Refer to [plugin-examples](https://github.com/grafana/grafana-plugin-examples) to review best practices for building your plugin.

### Frequently Asked Questions

**Do I need to submit a private plugin?**

- No. Please only submit plugins that you wish to make publicly available for the Grafana community.

**How long does it take to review my submission?**

- We're not able to give an estimate at this time, though we're constantly working on improving the time it takes to review a plugin.

**Can I decide a date when my plugin will be published?**

- No. We cannot guarantee specific publishing dates, as plugins are immediately published after a review based on our internal prioritization.

**Can I see metrics of my plugin installs, downloads or usage?**

- No. We don't offer this information at the moment to plugin authors.

**How can I update my plugin's catalog page?**

- The plugin's catalog page content is extracted from the plugin README file.
  To update the plugin's catalog page, it is necessary to submit an updated plugin with the new content included in the README file.

**Can I unlist my plugin from the Grafana Plugin's Catalog in case of a bug?**

- In the event of a bug, unlisting the plugin from the Grafana Plugin's Catalog may be possible in exceptional cases, such as security concerns.
  However, we do not have control over the specific instances where the plugin is installed.

**Can I distribute my plugin somewhere else than the Grafana Catalog?**

- The official method for distributing Grafana plugins is through the Grafana Catalog.
  Alternative methods, such as installing private or development plugins on local Grafana instances, are available as per the guidelines provided in [this guide]({{< relref "../../administration/plugin-management#install-plugin-on-local-grafana" >}}).

**Can I still use Angular for my plugin?**

- No. We will not accept any new plugin submissions written in angular.
  Please take a look at our [angular support deprecation documentation]({{< relref "../angular_deprecation" >}}).

### Publishing your plugin for the first time

**Do plugin signatures expire?**

- Plugin signatures do not currently expire.

{{< figure src="/static/img/docs/plugins/plugins-submission-create2.png" class="docs-image--no-shadow" max-width="650px" >}}

1. [Sign in](/auth/sign-in) to your Grafana Cloud account.
1. In the left menu, under **Org settings**, click **My Plugins**.
1. Click **Submit Plugin**.
1. Enter the information requested by the form.
   - **OS & Architecture:**
     - Select **Single** if your plugin archive contains binaries for multiple architectures.
     - Select **Multiple** if you'd like to submit separate plugin archives for each architecture.
       This can lead to faster downloads since users can select the specific architecture on which they want to install the plugin.
   - **URL:** A URL that points to a ZIP archive of your packaged plugin.
   - **Source Code URL:** A URL that points to a public git repository or ZIP archive of your complete plugin source code.
   - **MD5:** The MD5 hash of the plugin specified by the **URL**.
   - The remaining questions help us determine the [signature level]({{< relref "./sign-a-plugin#plugin-signature-levels" >}}) for your plugin.
1. Click **Submit**.
   After you have submitted your plugin, we run an automated validation to make sure it adheres to our guidelines.
   Once your submission passes the validation, it's placed in a review queue.

All submissions are manually inspected by a plugin reviewer.
For every new plugin, we perform a manual review that includes the following checks:

- **Code review:** For quality and security purposes, we review the source code for the plugin.
  If you're unable to make the source code publicly available, let us know in a comment on your plugin submission.
- **Tests:** We install your plugin on one of our Grafana instances to test it for basic use.
  For more advanced plugins, we may ask you to assist us in configuring a test environment for the plugin.
  This test environment will be used whenever you submit an plugin update.

### Submit a plugin update

To submit an **update** for an already published plugin:

1. [Sign in](/auth/sign-in) to your Grafana Cloud account.
1. In the left menu, under **Org settings**, click **My Plugins**.
1. Click **Submit Update** for the plugin you want to update.
1. Enter the information requested by the form.
   - **OS & Architecture:**
     - Select **Single** if your plugin archive contains binaries for multiple architectures.
     - Select **Multiple** if you'd like to submit separate plugin archives for each architecture.
       This can lead to faster downloads since users can select the specific architecture they want to install the plugin on.
   - **URL:** A URL that points to a ZIP archive of your packaged plugin.
   - **Source Code URL:** A URL that points to a public git repository or ZIP archive of your complete plugin source code.
   - **MD5:** The MD5 hash of the plugin specified by the **URL**.
1. Click **Submit**.
