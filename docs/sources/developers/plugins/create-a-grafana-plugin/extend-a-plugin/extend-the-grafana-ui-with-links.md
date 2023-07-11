---
title: Use extensions to add links to app plugins
aliases:
  - ../../../plugins/extend-the-grafana-ui-with-links/
keywords:
  - grafana
  - plugins
  - plugin
  - links
  - extensions
  - app plugins
description: Learn how to add links to the Grafana user interface from an app plugin
weight: 760
---

# Use extensions to add links to app plugins

You can use the Plugin extensions API with your Grafana app plugins to add links to the Grafana UI. This feature lets you send users to your plugin's pages from other spots in the Grafana application.

## Before you begin

Be sure your plugin meets the following requirements before proceeding:

- It must be an app plugin.
- It must be preloaded (by setting the [preload property]({{< relref "../../metadata.md" >}}) to `true` in the `plugin.json`
- It must be installed and enabled.

## Available extension points within Grafana

An _extension point_ is a location within the Grafana UI where a plugin can insert links. The IDs of all extension points within Grafana start with `grafana/`. For example, you can use the following extension point ID:

- `grafana/dashboard/panel/menu`: extension point for all panel dropdown menus in dashboards

## Add a link extension within a Grafana dashboard panel menu

To add a link extension within a Grafana dashboard panel menu, complete the following steps:

1. Define the link extension in your plugin's `module.ts` file.

1. Define a new instance of the `AppPlugin` class by using the `configureExtensionLink` method. This method requires:
   - an object that describes your link extension, including a `title` property for the link text
   - an `extensionPointId` method that tells Grafana where the link should appear
   - a `path` for the user to go to your plugin

```typescript
new AppPlugin().configureExtensionLink({
  title: 'Go to basic app',
  description: 'Will send the user to the basic app',
  extensionPointId: 'grafana/dashboard/panel/menu',
  path: '/a/myorg-basic-app/one', // Must start with "/a/<PLUGIN_ID>/"
});
```

Your link will now appear in dashboard panel menus. When the user clicks the link, they will be sent to the path you defined earlier.

{{% admonition type="note" %}} Each plugin is limited to a maximum of two links per extension point.{{%
/admonition %}}

## Add a link extension using context within Grafana

The above example works for simple cases. However, you may want to act on information from the app's panel from which the user is navigating.

To do this, use the `configure` property on the object that is passed to `configureExtensionLink()`. This property takes a function and returns an object that consists of a `title` property for the link text and a `path` to send the user to your plugin.

Alternatively, if you need to hide the link for certain scenarios, define the function to return _undefined_:

```typescript
new AppPlugin().configureExtensionLink({
  title: 'Go to basic app',
  description: 'Will send the user to the basic app',
  extensionPointId: 'grafana/dashboard/panel/menu',
  path: '/a/myorg-basic-app/one',
  configure: (context: PanelContext) => {
    switch (context?.pluginId) {
      case 'timeseries':
        return {
          title: 'Go to page one',
          description: 'hello',
          path: '/a/myorg-basic-app/one',
        };

      case 'piechart':
        return {
          title: 'Go to page two',
          path: '/a/myorg-basic-app/two',
        };

      // Returning undefined tells Grafana to hide the link
      default:
        return undefined;
    }
  },
});
```

The above example demonstrates how to return a different `path` based on which plugin the dashboard panel is using. If the clicked-upon panel is neither a time series nor a pie chart panel, then the `configure()` function returns _undefined_. When this happens, Grafana doesn't render the link.

{{% admonition type="note" %}} The context passed to the `configure()` function is bound by the `extensionPointId` into which you insert the link. Different extension points contain different contexts.{{%
/admonition %}}

## Add an event handler to a link

Link extensions give you the means to direct users to a plugin page via href links within the Grafana UI. You can also use them to trigger `onClick` events to perform dynamic actions when clicked.

To add an event handler to a link in a panel menu, complete the following steps:

1. Define the link extension in the plugin's `module.ts` file.
1. Create a new instance of the `AppPlugin` class, again using the `configureExtensionLink` method. This time, add an `onClick` property which takes a function. This function receives the click event and an object consisting of the `context` and an `openModal` function.

In the following example, we open a dialog.

```typescript
new AppPlugin().configureExtensionLink({
  title: 'Go to basic app',
  description: 'Will send the user to the basic app',
  extensionPointId: 'grafana/dashboard/panel/menu',
  path: '/a/myorg-basic-app/one',
  onClick: (event, { context, openModal }) => {
    event.preventDefault();
    openModal({
      title: 'My plugin dialog',
      body: ({ onDismiss }) => <SampleModal onDismiss={onDismiss} pluginId={context?.pluginId} />,
    });
  },
});

type Props = {
  onDismiss: () => void;
  pluginId?: string;
};

const SampleModal = ({ onDismiss, pluginId }: Props) => {
  return (
    <VerticalGroup spacing="sm">
      <p>This dialog was opened via the plugin extensions API.</p>
      <p>The panel is using a {pluginId} plugin to display data.</p>
    </VerticalGroup>
  );
};
```

As you can see, the plugin extensions API enables you to insert links into the UI of Grafana applications that send users to plugin features or trigger actions based on where the user clicked. The plugins extension API can also be used for [cross-plugin linking]({{< relref "./cross-plugin-linking" >}}).
