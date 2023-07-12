---
title: Migrate plugins from Grafana 9.3.x to 9.4.x
menuTitle: v9.3.x to v9.4.x
description: Guide for migrating plugins from Grafana v9.3.x to v9.4.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
weight: 2000
---

# Migrate plugins from Grafana 9.3.x to 9.4.x

Follow the instructions in this section to migrate from Grafana 9.3.x to 9.4.x.

## New navigation layout is supported

First, enable the `topnav` feature flag in `custom.ini` to check how your plugin renders in the new navigation layout:

```ini
[feature_toggles]
enable = topnav
```

### Migrate from `onNavChanged`

If your plugin uses the `onNavChanged` callback to inform Grafana of its navigation model and child pages, you should see that this results in duplicated navigation elements. If you disable `topnav`, then it should look just like before.

If `topnav` is enabled, then we need to update the plugin to take advantage of the new `PluginPage` component. In this case, we do not call `onNavChanged`, which is now deprecated.

### Switch to `PluginPage` component

Grafana now exposes a new `PluginPage` component from `@grafana/runtime` that hooks into the new navigation and page layouts. This new component also supports the old page layouts when the `topnav` feature is disabled.

The new `PluginPage` component will also handle rendering the section navigation. The section navigation can include other core sections and other plugins. To control what pages are displayed in the section navigation for a specific plugin, Grafana uses the pages that have been added in `plugin.json` in which `addToNav` was set to `true`.

To use this component, simply wrap it around your page content:

```tsx
import { PluginPage } from '@grafana/runtime';

...

return (
  <PluginPage>
    {your page content here}
  </PluginPage>
);
```

Grafana looks at the URL to know what plugin and page should be active in the section nav. Accordingly, this component only works for pages that you have specified in `plugin.json`. The `PluginPage` will then render a page header based on the page name specified in `plugin.json`.

### Use `PluginPage` for pages not defined in `plugin.json`

The `PluginPage` component also exposes a `pageNav` property that is a `NavModelItem`. This `pageNav` property is useful for pages that are not defined in `plugin.json` (for example, individual item pages). The `text` and `description` that you specify in the `pageNav` model are used to populate the breadcrumbs and the page header.

**Example:**

```tsx
const pageNav = {
  text: 'Write errors cortex-prod-04',
  description: 'Incident timeline and details'
};

return (
  <PluginPage pageNav={pageNav}>
    {your page content here}
  </PluginPage>
);
```

The way the active page is matched in the breadcrumbs and section nav relies on the page routes being hierarchical. If you have a list page and an item page, then you need to make the item page into a subroute of the list page. Furthermore, you also need to specify the list page URL in your `plugin.json`.

For example, you might have a list of users at `/users`. This means that the item page for a specific user needs to be at `/users/:id`. This may require some refactoring of your routes.

### Use `PluginPage` with tabs

You can also create a further layer of hierarchy by specifying `children` in the `pageNav` model to create a page with tabbed navigation.

**Example:**

```tsx
const pageNav = {
  text: 'My page',
  description: 'Incident timeline and details',
  url: '/a/myorgid-pluginname-app',
  children: [
    {
      url: '/a/myorgid-pluginname-app/tab1',
      text: 'Tab1',
      active: true,
    },
    {
      url: '/a/myorgid-pluginname-app/tab2',
      text: 'Tab1',
    },
  ],
};

return (
  <PluginPage pageNav={pageNav}>
    {your page content here}
  </PluginPage>
);
```

### Use `PluginPage` in a backwards-compatible way

If you want to maintain backwards-compatibility with older versions of Grafana, one way is to implement a `PluginPage` wrapper. If `PluginPage` is available and the `topnav` feature is enabled, then use the real `PluginPage`. In other scenarios, fall back to whatever each plugin is doing today (such as making a call to `onNavChanged`).

**Example:**

```tsx
import { PluginPageProps, PluginPage as RealPluginPage, config } from '@grafana/runtime';

export const PluginPage = RealPluginPage && config.featureToggles.topnav ? RealPluginPage : PluginPageFallback;

function PluginPageFallback(props: PluginPageProps) {
  return props.children;
}
```

There’s an additional step (and `if` block) that is needed to hide or show tabs depending on whether `config.features.topnav` is `true`. Your plugin needs to include these changes in the `useNavModel.ts` file:

```tsx
// useNavModel.ts

import { config } from '@grafana/runtime';

...

export function useNavModel({ meta, rootPath, onNavChanged }: Args) {
const { pathname, search } = useLocation();
useEffect(() => {
  if (config.featureToggles.topnav) {
    return;
  }
}, [config]);

...
```

## Forwarded HTTP headers in the plugin SDK for Go

We recommended to use the `<request>.GetHTTPHeader` or `<request>.GetHTTPHeaders` methods when retrieving forwarded HTTP headers. See [Forward OAuth identity for the logged-in user]({{< relref "../../create-a-grafana-plugin/extend-a-plugin/add-authentication-for-data-source-plugins.md#forward-oauth-identity-for-the-logged-in-user" >}}), [Forward cookies for the logged-in user
]({{< relref "../../create-a-grafana-plugin/extend-a-plugin/add-authentication-for-data-source-plugins.md#forward-user-header-for-the-logged-in-user" >}}) or [Forward user header for the logged-in user]({{< relref "../../create-a-grafana-plugin/extend-a-plugin/add-authentication-for-data-source-plugins.md#forward-user-header-for-the-logged-in-user" >}}) for example usages.

### Technical details

The Grafana SDK for Go [v0.147.0](https://github.com/grafana/grafana-plugin-sdk-go/releases/tag/v0.147.0) introduces a new interface [ForwardHTTPHeaders](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go@v0.147.0/backend#ForwardHTTPHeaders) that `QueryDataRequest`, `CheckHealthRequest` and `CallResourceRequest` implements.

Newly introduced forwarded HTTP headers in Grafana v9.4.0 are `X-Grafana-User`, `X-Panel-Id`, `X-Dashboard-Uid`, `X-Datasource-Uid` and `X-Grafana-Org-Id`. Internally, we prefix these with `http_` and they are sent as `http_<HTTP header name>` in [CheckHealthRequest.Headers](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go@v0.147.0/backend#CheckHealthRequest) and [QueryDataRequest.Headers](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go@v0.147.0/backend#QueryDataRequest).

We recommend using the [ForwardHTTPHeaders](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go@v0.147.0/backend#ForwardHTTPHeaders) methods so that you're guaranteed to be able to operate on HTTP headers without using the prefix. That is, you can operate on `X-Grafana-User`, `X-Panel-Id`, `X-Dashboard-Uid`, `X-Datasource-Uid` and `X-Grafana-Org-Id`.
