---
title: Cross plugin links
description: Learn how to add plugin links to a Grafana app plugin
---

# Cross plugin links

Using the Plugin extensions API, App plugins can register placements of their own to display other plugins links. This cross-plugin linking creates a more immersive user experience for installed plugins.

## Available placements within plugins

A placement is a location in another plugins UI where your plugin can insert links. All placement names within plugins must start with `plugins/<plugin-id>`.

## How to create a placement within a plugin

The `getPluginExtensions` method in `@grafana/runtime` can be used to create a placement within your plugin. A placement is a way of specifying where in the plugin UI other plugins links are rendered. `getPluginExtensions` takes an object consisting of the `placement` name, which must begin `plugin/<pluginId>`, and include any contextual information you would like to provide for the use of other plugins. It returns a list of `extensionLinks` that your program can loop over.

_Note: Creating a placement in a plugin creates a public interface for other plugins to interact with. Changes to the placement or the context it passes could break any plugin that attempts to register a link inside your plugin._

```typescript
import { getPluginExtensions } from '@grafana/runtime';
import { isPluginExtensionLink } from '@grafana/data';
import { LinkButton } from '@grafana/ui';

function AppPlacementExample() {
  const { extensions } = getPluginExtensions({
    placement: 'plugin/another-app-plugin/menu', // Must start with "plugin/"
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

In the above example, we created a component that renders `<LinkButton />` or `<Button />` components depending on the type of extension other plugins register for the `plugin/another-app-plugin/menu` placement. We pass the context as the second parameter to `getPluginExtensions`, which will use `Object.freeze` to make the context immutable before passing it to other plugins.

## How to insert links into another plugin

Create links from other plugins in the same way you would [extend the Grafana application UI]({{< relref "./extend-the-grafana-ui-with-links-and-commands" >}}) with a link. Rather than specify a `grafana/...` placement, specify the plugin placement `plugin/<pluginId>/<placementId>` instead. Given the placement example above, use a plugin link such as the following.

### Link example

```typescript
new AppPlugin().configureExtensionLink({
  title: 'Go to basic app',
  description: 'Will navigate the user to the basic app',
  placement: 'plugin/another-app-plugin/menu',
  path: '/a/myorg-basic-app/one',
});
```
