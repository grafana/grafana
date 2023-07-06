---
title: Work with cross-plugin links
aliases:
  - ../../../plugins/cross-plugin-linking/
keywords:
  - grafana
  - plugins
  - plugin
  - links
  - cross-plugin links
  - extensions
  - extensions api
description: Learn how to add plugin links to a Grafana app plugin.
weight: 800
---

# Work with cross-plugin links

With the Plugins extension API, app plugins can register extension points of their own to display other plugins links. This is called _cross-plugin linking_, and you can use it to create more immersive user experiences with installed plugins.

## Available extension points within plugins

An extension point is a location in another plugin's UI where your plugin can insert links. All extension point IDs within plugins should follow the naming convention `plugins/<plugin-id>/<extension-point-id>`.

## How to create an extension point within a plugin

Use the `getPluginExtensions` method in `@grafana/runtime` to create an extension point within your plugin. An extension point is a way to specify where in the plugin UI other plugins links are rendered.

{{% admonition type="note" %}}
Creating an extension point in a plugin creates a public interface for other plugins to interact with. Changes to the extension point ID or its context could break any plugin that attempts to register a link inside your plugin.
{{% /admonition %}}

The `getPluginExtensions` method takes an object consisting of the `extensionPointId`, which must begin `plugin/<pluginId>`, and any contextual information that you want to provide. The `getPluginExtensions` method returns a list of `extensionLinks` that your program can loop over:

```typescript
import { getPluginExtensions } from '@grafana/runtime';
import { isPluginExtensionLink } from '@grafana/data';
import { LinkButton } from '@grafana/ui';

function AppExtensionPointExample() {
  const { extensions } = getPluginExtensions({
    extensionPointId: 'plugin/another-app-plugin/menu',
    context: {
      pluginId: 'another-app-plugin',
    },
  });

  if (extensions.length === 0) {
    return null;
  }

  return (
    <div>
      {extensions.map((extension) => {
        if (isPluginExtensionLink(extension)) {
          return (
            <LinkButton href={extension.path} title={extension.description} key={extension.key}>
              {extension.title}
            </LinkButton>
          );
        }

        return null;
      })}
    </div>
  );
}
```

The preceding example shows a component that renders `<LinkButton />` components for all link extensions that other plugins registered for the `plugin/another-app-plugin/menu` extension point ID. The context is passed as the second parameter to `getPluginExtensions`, which uses `Object.freeze` to make the context immutable before passing it to other plugins.

## Insert links into another plugin

Create links for other plugins in the same way you [extend the Grafana application UI]({{< relref "./extend-the-grafana-ui-with-links" >}}) with a link. Don't specify a `grafana/...` extension point. Instead, specify the plugin extension point `plugin/<pluginId>/<extensionPointId>`.

Given the preceding example, use a plugin link such as the following:

```typescript
new AppPlugin().configureExtensionLink({
  title: 'Go to basic app',
  description: 'Will navigate the user to the basic app',
  extensionPointId: 'plugin/another-app-plugin/menu',
  path: '/a/myorg-basic-app/one',
});
```
