---
title: Cross plugin links
description: Learn how to add plugin links to a Grafana app plugin
---

# Cross plugin links

Using the Plugin extensions API, App plugins can register extension points of their own to display other plugins links. This cross-plugin linking creates a more immersive user experience for installed plugins.

## Available extension points within plugins

An extension point is a location in another plugins UI where your plugin can insert links. All extension point ids within plugins should follow the naming convention `plugins/<plugin-id>/<extension-point-id>`.

## How to create an extension point within a plugin

The `getPluginExtensions` method in `@grafana/runtime` can be used to create an extension point within your plugin. An extension point is a way of specifying where in the plugin UI other plugins links are rendered. `getPluginExtensions` takes an object consisting of the `extensionPointId`, which must begin `plugin/<pluginId>`, and any contextual information you would like to provide. It returns a list of `extensionLinks` that your program can loop over.

_Note: Creating a extension point in a plugin creates a public interface for other plugins to interact with. Changes to the extension point id or the context it passes could break any plugin that attempts to register a link inside your plugin._

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

In the above example, we created a component that renders `<LinkButton />` components for all link extensions other plugins registered for the `plugin/another-app-plugin/menu` extension point id. We pass the context as the second parameter to `getPluginExtensions`, which will use `Object.freeze` to make the context immutable before passing it to other plugins.

## How to insert links into another plugin

Create links for other plugins in the same way you would [extend the Grafana application UI]({{< relref "./extend-the-grafana-ui-with-links" >}}) with a link. Rather than specify a `grafana/...` extension point, specify the plugin extension point `plugin/<pluginId>/<extensionPointId>` instead. Given the example above, use a plugin link such as the following.

### Link example

```typescript
new AppPlugin().configureExtensionLink({
  title: 'Go to basic app',
  description: 'Will navigate the user to the basic app',
  extensionPointId: 'plugin/another-app-plugin/menu',
  path: '/a/myorg-basic-app/one',
});
```
