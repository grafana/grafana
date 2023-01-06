---
aliases:
  - share-a-plugin/
title: Package a plugin
type: docs
---

# Package a plugin

You've just built your first plugin, and now you want to share it with the world. In this guide, you'll learn how to package and share your plugin with others.

For Grafana to be able to load a plugin, it first needs to be built. When you build a plugin from source, a `dist` directory is created that contains the production build, or _plugin assets_, for your plugin.

When the Grafana server starts, it recursively looks in the plugin directory for any directory that contains a `plugin.json` file and tries to load the plugin assets in the same directory.

There are three steps needed to package a plugin:

- Building the plugin
- Signing the plugin
- Archiving the plugin

1. Build the plugin

   ```
   yarn install --pure-lockfile
   yarn build
   ```

1. (Optional) If your data source plugin has a backend plugin, build it as well.

   ```
   mage
   ```

1. [Sign the plugin]({{< relref "sign-a-plugin.md" >}}).

1. Create a ZIP archive of the `dist` directory.

   ```
   mv dist/ myorg-simple-panel
   zip myorg-simple-panel-1.0.0.zip myorg-simple-panel -r
   ```

# Publish your plugin on Grafana.com

The best way to share your plugin with the world is to publish it on [Grafana Plugins](https://grafana.com/plugins). By having your plugin published on Grafana.com, more users will be able to discover your plugin.

Before you submit your plugin, we ask that you read our guidelines and frequently asked questions.

## Guidelines

To speed up the time it takes to review your plugin:

- Check that your plugin is ready for review using the [plugin validator](https://github.com/grafana/plugin-validator).
- Read our [6 tips for improving your Grafana plugin before you publish](https://grafana.com/blog/2021/01/21/6-tips-for-improving-your-grafana-plugin-before-you-publish/).

## Frequently Asked Questions

**Do I need to submit a private plugin?**

- No. Please only submit plugins that you wish to make publicly available for the Grafana community.

**How long does it take to review my submission?**

- We're not able to give an estimate at this time, though we're constantly working on improving the time it takes to review a plugin.

## Publishing your plugin for the first time

{{< figure src="/static/img/docs/plugins/plugins-submission-create2.png" class="docs-image--no-shadow" max-width="650px" >}}

1. [Sign in](https://grafana.com/auth/sign-in) to your Grafana Cloud account.
1. In the left menu, under **Org settings**, click **My Plugins**.
1. Click **Submit Plugin**.
1. Enter the information requested by the form.
   - **OS & Architecture:**
     - Select **Single** if your plugin archive contains binaries for multiple architectures.
     - Select **Multiple** if you'd like to submit separate plugin archives for each architecture. This can lead to faster downloads since users can select the specific architecture on which they want to install the plugin.
   - **URL:** A URL that points to a ZIP archive of your packaged plugin.
   - **Source Code URL:** A URL that points to a public git repository or ZIP archive of your complete plugin source code.
   - **MD5:** The MD5 hash of the plugin specified by the **URL**.
   - The remaining questions help us determine the [signature level](https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/#plugin-signature-levels) for your plugin.
1. Click **Submit**.
   After you have submitted your plugin, we run an automated validation to make sure it adheres to our guidelines. Once your submission passes the validation, it's placed in a review queue.

All submissions are manually inspected by a plugin reviewer. For every new plugin, we perform a manual review that includes the following checks:

- **Code review:** For quality and security purposes, we review the source code for the plugin. If you're unable to make the source code publicly available, let us know in a comment on your plugin submission.
- **Tests:** We install your plugin on one of our Grafana instances to test it for basic use. For more advanced plugins, we may ask you to assist us in configuring a test environment for the plugin. This test environment will be used whenever you submit an plugin update.

## Maintain your plugin

To submit an **update** for an already published plugin:

1. [Sign in](https://grafana.com/auth/sign-in) to your Grafana Cloud account.
1. In the left menu, under **Org settings**, click **My Plugins**.
1. Click **Submit Update** for the plugin you want to update.
1. Enter the information requested by the form.
   - **OS & Architecture:**
     - Select **Single** if your plugin archive contains binaries for multiple architectures.
     - Select **Multiple** if you'd like to submit separate plugin archives for each architecture. This can lead to faster downloads since users can select the specific architecture they want to install the plugin on.
   - **URL:** A URL that points to a ZIP archive of your packaged plugin.
   - **Source Code URL:** A URL that points to a public git repository or ZIP archive of your complete plugin source code.
   - **MD5:** The MD5 hash of the plugin specified by the **URL**.
1. Click **Submit**.
