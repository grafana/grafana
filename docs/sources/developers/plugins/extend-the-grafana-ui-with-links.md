---
title: Use extensions to add new functionality in the Grafana user interface
description: Learn how to add links to the Grafana user interface from an app plugin
---

# The when, why and how of UI extensions

Before we go into details we need to cover the two major concepts in the UI extensions feature of Grafana.

1. Extension point - a place in the UI where plugins can provide new functionality to the end user. Examples of extension points are the dashboard panel menu or toolbar in explore.
2. Extensions - New functionality, ususally registered by an app plugin, that will be displayed at an extension point. Examples of extensions are the possibility to create an incident directly from the dashboard panel menu.

![panel menu](https://user-images.githubusercontent.com/172951/242723354-a10d6238-22f1-4458-b85e-ac3c7f014b22.png)

In the example above we have one extension point with two extensions registered. This highlights one of the benefits of using UI extensions. Once you have added an extension point to your UI it can be extended multiple times by multiple plugins.

## When should I add an extension point?

If you have parts of your UI where it would improve the user experience to allow users to trigger functionality directly from the current view instead of navigating to the plugin. If this is the case, then it might be a good idea to consider adding an extension point.

Examples where it would be useful:

- The user views a dashboard with historical data. By adding an extension point to this part of the UI the Machine Learning app plugin can give the user the ability to create a forcast for that data directly from the panel.
- The user views a firing alert. By adding an extension point to this part of the UI the Incident app plugin can give the user the ability to create an incident directly from the alert view.

## Why should I add an extension point?

Adding an extension point to your UI gives a number of benefits souch as:

- Add the UI extension point once to enable multiple plugins to extend your UI with new functionality. No additional effort needed to provide functionality from more plugins in your UI.
- Clean separation of concerns. Your application does not need to know anything about the plugin extending your UI.
- Integration build for change. Since your application doesn't know anything about the internals of the plugin extending your UI they are free to change their APIs without risk of breaking the extension point UI.
- Easy to bootstrap. If both apps are installed and enabled the extensions will automatically be configured and displayed to the user.
- Extensions are fast. We pre build the extensions registry at Grafana boot time which makes it fast to use while rendering the UI.

## How should I add an extension point to my UI?

There are a couple of things you need to consider when adding an extension point to your UI. The first one is to define an extension point ID. It is basically just a string describing the part of the UI where the extension point lives. You should be able to figure out where in the UI the extensions will be added by reading the extension point ID.

Extension points living in core Grafana should start with `grafana/` and extension points living in plugins should start with the plugin id e.g. `myorg-basic-app/`.

The second thing you need to consider is how to design the UI of the extension point so it supports a scenario where multiple extensions are being added without breaking the UI.

You also need to consider if there are any information from the current view that should be shared with the extensions added to the extension point. It could be information from the current view that could let the extending plugin prefill values etc in the functionality being added via the extension.

Lastly you need to call the `getPluginExtensions` with your extension point ID to recieve the list of configured extensions for your extension point.

```typescript
const extensionPointId = 'plugins/myorg-extensionpoint-app/actions';
const context: AppExtensionContext = {
  // Add information that should be shared with the extensions to this object.
};

const { extensions } = getPluginExtensions({
  extensionPointId,
  context,
});
```

# How can I extend a plugin/Grafana with new functionality?

## Before you begin

Be sure your plugin meets the following requirements before proceeding:

- It must be an app plugin.
- It must be preloaded (by setting the [preload property]({{< relref "./metadata" >}}) to `true` in the `plugin.json`
- It must be installed and enabled.

## Available extension points within Grafana

An _extension point_ is a location within the Grafana UI where a plugin can insert links. The IDs of all extension points within Grafana start with `grafana/`. For example, you can use the following extension point ID:

- `grafana/dashboard/panel/menu`: extension point for all panel dropdown menus in dashboards
- `grafana/explore/toolbar/action`: extension point for toolbar actions in explore

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
