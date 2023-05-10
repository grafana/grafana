---
aliases:
  - share-a-plugin/
description: Learn how to package and share your plugin.
title: Publish a plugin
type: docs
---

# Publish or update a plugin

You've just built your plugin; now you want to share it with the world.

In this guide, you'll learn how to package and share your plugin with others.

The best way to share your plugin with the world is to publish it in the [Grafana plugin catalog]{{< relref "/plugins" >}}).
By having your plugin published on Grafana.com, more users will be able to discover your plugin.

## Before you begin

When you build a plugin from source, a `dist` folder is created. This folder contains the production build or _plugin assets_ for your plugin.

To package a plugin, refer to [Package a plugin]{{< relref "package-a-plugin.md" >}}).

### Follow our guidelines

Get familiar with our plugin [publishing and signing criteria]({{< relref "./publishing-and-signing-criteria" >}})

### Do this for best results

To speed up the time it takes to review your plugin:

- Check that your plugin is ready for review using the [plugin validator](https://github.com/grafana/plugin-validator).
- Read our [6 tips for improving your Grafana plugin before you publish](/blog/2021/01/21/6-tips-for-improving-your-grafana-plugin-before-you-publish/).
- Refer to [plugin-examples](https://github.com/grafana/grafana-plugin-examples) to review best practices for building your plugin.

## Publish your plugin

Follow these steps to publish your plugin for the first time.

1. [Sign in](/auth/sign-in) to your Grafana Cloud account.
1. In the left menu, under **Org settings**, click **My Plugins**.
1. Click **Submit Plugin**. The Create Plugin Submission dialog appears.

   {{< figure src="/static/img/docs/plugins/plugins-submission-create2.png" class="docs-image--no-shadow" max-width="650px" >}}

1. Enter the information requested by the form.
   - **OS & Architecture:**
     - Select **Single** if your plugin archive contains binaries for multiple architectures.
     - Select **Multiple** if you'd like to submit separate plugin archives for each architecture.
       This can lead to faster downloads since users can select the specific architecture on which they want to install the plugin.
   - **URL:** A URL that points to a ZIP archive of your packaged plugin.
   - **Source Code URL:** A URL that points to a public Git repository or ZIP archive of your complete plugin source code.
   - **MD5:** The MD5 hash of the plugin specified by the **URL**.
   - The remaining questions help us determine the [signature level]({{< relref "./sign-a-plugin#plugin-signature-levels" >}}) for your plugin.
1. Click **Submit**.
   After you submit your plugin, we run an automated validation to make sure it adheres to our guidelines.
   Once your submission passes the validation, it's placed in a review queue.
   All submissions are manually inspected by a plugin reviewer.
   For every new plugin, we perform a manual review that includes the following checks:

- **Code review:** For quality and security purposes, we review the source code for the plugin.
  If you're unable to make the source code publicly available, let us know in a comment on your plugin submission.
- **Tests:** We install your plugin on one of our Grafana instances to test it for basic use.
  For more advanced plugins, we may ask you to assist us in configuring a test environment for the plugin.
  We use the test environment whenever you submit a plugin update.

## Update your plugin

To submit an **update** for an already published plugin:

1. [Sign in](/auth/sign-in) to your Grafana Cloud account.
1. In the left menu, under **Org settings**, click **My Plugins**.
1. Click **Submit Update** for the plugin you want to update. The Create Plugin Submission dialog appears.
   {{< figure src="/static/img/docs/plugins/plugins-submission-create2.png" class="docs-image--no-shadow" max-width="650px" >}}
1. Enter the information requested by the form.
   - **OS & Architecture:**
     - Select **Single** if your plugin archive contains binaries for multiple architectures.
     - Select **Multiple** if you'd like to submit separate plugin archives for each architecture.
       This can lead to faster downloads since users can select the specific architecture they want to install the plugin on.
   - **URL:** A URL that points to a ZIP archive of your packaged plugin.
   - **Source Code URL:** A URL that points to a public Git repository or ZIP archive of your complete plugin source code. See [examples](#what-source-code-url-formats-are-supported).
   - **MD5:** The MD5 hash of the plugin specified by the **URL**.
1. Click **Submit**.

## Frequently asked questions

### Do I need to submit a private plugin?

- No. Please only submit plugins that you wish to make publicly available for the Grafana community.

### How long does it take to review my submission?

- We're not able to give an estimate at this time, though we're constantly working on improving the time it takes to review a plugin.

### Can I decide a date when my plugin will be published?

- No. We cannot guarantee specific publishing dates, as plugins are immediately published after a review based on our internal prioritization.

### Can I see metrics of my plugin installs, downloads or usage?

- No. We don't offer this information at the moment to plugin authors.

### How can I update my plugin's catalog page?

- The plugin's catalog page content is extracted from the plugin README file.
  To update the plugin's catalog page, submit an updated plugin with the new content included in the README file.

### Can I unlist my plugin from the Grafana plugin catalog in case of a bug?

- In the event of a bug, unlisting the plugin from our catalog may be possible in exceptional cases, such as security concerns. However, we don't have control over the instances where the plugin is installed.

### Can I distribute my plugin somewhere else other than the Grafana plugin catalog?

- The official method for distributing Grafana plugins is through our catalog. Alternative methods, such as installing private or development plugins on local Grafana instances, are available as per the guidelines provided in [this guide]({{< relref "../../administration/plugin-management#install-plugin-on-local-grafana" >}}).

### Can I still use Angular for my plugin?

- No. We will not accept any new plugin submissions written in Angular. For more information, refer to our [Angular support deprecation documentation]({{< relref "../angular_deprecation" >}}).

### Do plugin signatures expire?

- Plugin signatures do not currently expire.

### What source code URL formats are supported?

- Using a tag or branch: `https://github.com/grafana/clock-panel/tree/v2.1.3`
- Using a tag or branch and the code is in a subdirectory (important for mono repos): `https://github.com/grafana/clock-panel/tree/v2.1.3/plugin/` (here, the plugin contains the plugin code)
- Using the latest main or master branch commit: `https://github.com/grafana/clock-panel/` (not recommended, it's better to pass a tag or branch)
