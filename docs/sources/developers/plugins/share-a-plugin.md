+++
title = "Share a plugin"
type = "docs"
+++

# Share a plugin

You've just built your first plugin, and now you want to share it with the world. In this guide, you'll learn how to package and share your plugin with others.

When you build a plugin from source, a `dist` directory is created that contains the production build, or _plugin assets_, for your plugin.

When loading your plugin, Grafana only cares about the plugin assets. Specifically, when the Grafana server starts, it attempts to discover and load plugins like this:

1. Look for a `plugin.json` file in any of the subdirectories in the plugin directory.
1. If a `plugin.json` was found, try to load the plugin assets from a `dist` directory in the same directory as the `plugin.json` file.
1. If there's no `dist` directory, try to load the plugin assets from the same directory as the `plugin.json` file.

Now that you know what Grafana needs to load your plugin, let's see how you can share the plugin with other users.

The best way to share your plugin with the world is to publish it on [Grafana Plugins](https://grafana.com/plugins). However, if you're not ready to make your plugin public just yet, you can still share your plugin by hosting the plugin yourself.

## Publish your plugin on Grafana.com

To publish a plugin to [Grafana Plugins](https://grafana.com/grafana/plugins), your plugin first needs to be publicly available in a commit on [GitHub](https://github.com).

The commit you submit needs to either:

- Contain a `dist` directory with the plugin assets
- Contain the plugin assets in the root directory

We strongly recommend that you don't check in the plugin assets to the main branch. Instead, use the following steps to create a release branch that contains the plugin assets.

1. Create a release branch.

   ```
   git checkout -b release-0.1.x
   ```

1. Build the plugin assets.

   ```
   yarn build
   ```

1. Add the `dist` directory. The `-f` flag adds the directory even if it's ignored by `.gitignore`.

   ```
   git add -f dist
   ```

1. Create the release commit.

   ```
   git commit -m "Release v0.1.0"
   ```

1. Create a release tag. You can also [create the release on GitHub](https://docs.github.com/en/github/administering-a-repository/managing-releases-in-a-repository). If you do, then you can skip this step and the next one.

   ```
   git tag -a v0.1.0 -m "Create release tag v0.1.0"
   ```

1. Push to GitHub. `follow-tags` tells Git to push the release tag along with our release branch.

   ```
   git push --set-upstream origin release-0.1.x --follow-tags
   ```

The next step is to submit the URL to your repository, and the release commit, to the [Grafana Plugin Repository](https://github.com/grafana/grafana-plugin-repository).

## Host the plugin yourself

If you want to share your plugin by hosting it yourself, then we recommend that you package it by adding the plugin assets to a .zip archive. You can then make the archive available by hosting it yourself.

How you package the plugin depends on whether you want to include the source code or not.

### Package the plugin with source code

If you want to distribute the source code along with your plugin assets, then you can archive the entire plugin directory.

To create a .zip archive that contains the plugin assets and source code, run the following commands in your terminal:

```
cd my-plugin/
yarn build
zip my-plugin-0.2.0.src.zip . -r -x "node_modules/*" -x ".git/*"
```

### Package the plugin without source code

If you don't want to distribute the plugin with the source code, then you can archive the `dist` directory.

To create a .zip archive that only contains the bare minimum to load the plugin, run the following commands in your terminal:

```
cd my-plugin/
yarn build
cd dist/
zip my-plugin-0.2.0.nosrc.zip . -r
```

### Package and host your plugin using GitHub

If you host your plugin on GitHub, then you can share the plugin using the following URL:

```
https://github.com/GITHUB_USERNAME/GITHUB_REPO_NAME/archive/<VERSION>.zip
```

For example, you can download the [Worldmap Panel](https://github.com/grafana/worldmap-panel) using the following URL:

[https://github.com/grafana/worldmap-panel/archive/v0.3.2.zip](https://github.com/grafana/worldmap-panel/archive/v0.3.2.zip)

### Install a packaged plugin

After the user has downloaded the archive containing the plugin assets, they can install it by extracting the archive into their plugin directory.

```
unzip my-plugin-0.2.0.zip -d YOUR_PLUGIN_DIR/my-plugin
```
