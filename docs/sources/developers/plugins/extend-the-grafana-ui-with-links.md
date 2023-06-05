---
title: Extend the Grafana UI with links
description: Learn how to add links to the Grafana user interface from an App plugin
---

# Extend the Grafana UI with links

Use the Plugin extensions API with your Grafana App plugins to add links to the Grafana UI. Doing so allows you to direct users to your plugins pages from various "extension points" within the Grafana application.

For a plugin to successfully register links it must:

- Be an App plugin.
- Be [preloaded]({{< relref "./metadata" >}}).
- Be installed and enabled.

## Available extension points within Grafana

An extension point is a location within the Grafana application UI where a plugin can insert links. All extension points within Grafana start with `grafana/`. The following extension point ids are available:

- `grafana/dashboard/panel/menu`: all panel menu dropdowns found in dashboards

## Add a link extension within Grafana

Here's how you can add a link to the dashboard panel menus in Grafana via your plugin:

Define the link extension in your plugin's `module.ts` file. First, define a new instance of the `AppPlugin` class by using the `configureExtensionLink` method. This method takes an object that describes your link extension, including a `title` property for the link text, a `extensionPointId` that tells Grafana where the link should appear, and a `path` for the user to navigate to your plugin.

```typescript
new AppPlugin().configureExtensionLink({
  title: 'Go to basic app',
  description: 'Will navigate the user to the basic app',
  extensionPointId: 'grafana/dashboard/panel/menu',
  path: '/a/myorg-basic-app/one', // Must start with "/a/<PLUGIN_ID>/"
});
```

That's it! Your link will be displayed in dashboard panel menus. When the user clicks the link, they will be navigated to the path you defined earlier.

_Note: Each plugin is limited to a maximum of two links per extension point._

## Add a link extension using context within Grafana

The above example works for simple cases however you may want to act on information from the panel the user is navigating from. This can be achieved by making use of the `configure` property which takes a function and returns an object that consists of a `title` property for the link text, a `path` to navigate the user to your plugin. Alternatively this function may return `undefined` if there's a need to hide the link for certain scenarios.

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

The above example demonstrates how to return a different link `path` based on which plugin the dashboard panel is using. If the clicked-upon panel is neither a timeseries nor a piechart panel, then the configure function returns `undefined` and the link isn't rendered.

_Note: The context passed to the `configure` function is bound by the `extensionPointId` the link is inserted into. Different extension points contain different contexts._

## Add an onClick event handler to a link

Link extensions provide the means to direct users to a plugin page via href links within the Grafana UI. They can also trigger onClick events to perform dynamic actions when clicked.

Here's how you can add an onClick handler to a link in the dashboard panel menus of Grafana via your plugin:

1. Define the link extension in the plugin's `module.ts` file.
2. Create a new instance of the `AppPlugin` class, again using the `configureExtensionLink` method. This time we add an `onClick` property which takes a function. This function receives the click `event` plus, an object consisting of the `context` and an `openModal` function.

In the following example, we open a modal.

```typescript
new AppPlugin().configureExtensionLink({
  title: 'Go to basic app',
  description: 'Will send the user to the basic app',
  extensionPointId: 'grafana/dashboard/panel/menu',
  path: '/a/myorg-basic-app/one',
  onClick: (event, { context, openModal }) => {
    event.preventDefault();
    openModal({
      title: 'My plugin modal',
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
      <p>This modal was opened via the plugin extensions API.</p>
      <p>The panel is using a {pluginId} plugin to display data.</p>
    </VerticalGroup>
  );
};
```

The plugin extensions API is a powerful feature for you to insert links into the UI of Grafana applications that send users to plugin features or trigger actions based on where the user clicked. This feature can also be used for [cross plugin linking]({{< relref "./cross-plugin-linking" >}}).
