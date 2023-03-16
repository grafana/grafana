---
aliases:
  - ../../plugins/developing/migration-guide#from-version-93x-to-94x
description: Guide for migrating plugins from Grafana v9.3.x to v9.4.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
title: Migrating plugins from Grafana 9.3.x to 9.4.x
menutitle: v9.3.x to v9.4.x
weight: 2000
---

# Migrating plugins from Grafana 9.3.x to 9.4.x

## Supporting new navigation layout

First, enable the `topnav` feature flag in `custom.ini` to check how your plugin renders in the new navigation layout:

```ini
[feature_toggles]
enable = topnav
```

### Migrate from `onNavChanged`

If your plugin uses the `onNavChanged` callback to inform Grafana of its nav model & sub pages, you should see that this results in duplicated navigation elements. If you disable `topnav` it should look just as before.

When `topnav` is enabled we need to update the plugin to take advantage of the new `PluginPage` component and not call `onNavChanged`. `onNavChanged` is now deprecated.

### Switch to `PluginPage` component

Grafana now exposes a new `PluginPage` component from `@grafana/runtime` that hooks into the new navigation and page layouts and supports the old page layouts when the `topnav` feature is disabled. This new component will also handle rendering the section navigation. The section navigation can include other core sections and other plugins. To control what pages are displayed in the section navigation for a specific plugin, Grafana will use the pages added in `plugin.json` that have `addToNav` set to `true`.

This component is very easy to use. Simply wrap it around your page content:

```tsx
import { PluginPage } from '@grafana/runtime';

...

return (
  <PluginPage>
    {your page content here}
  </PluginPage>
);
```

Grafana will look at the URL to know what plugin and page should be active in the section nav, so this only works for pages you have specified in `plugin.json`. `PluginPage` will then render a page header based on the page name specified in `plugin.json`.

### Using `PluginPage` for pages not defined in `plugin.json`

The `PluginPage` component also exposes a `pageNav` property that is a `NavModelItem`. This `pageNav` property is useful for pages that are not defined in `plugin.json` (e.g. individual item pages). The `text` and `description` you specify in the `pageNav` model will be used to populate the breadcrumbs and page header.

Example:

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

The way the active page is matched in the breadcrumbs and section nav relies on the page routes being hierarchical. If you have a list page and an item page, the item page needs to be a subroute of the list page and the list page url needs to be specified in your `plugin.json`. For example, you might have a list of users at `/users`. This means that the item page for a specific user needs to be at `/users/:id`. This may require some refactoring of your routes.

### Using `PluginPage` with tabs

You can also create a further layer of hierarchy by specifying `children` in the `pageNav` model to created a page with tabbed navigation.

Example:

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

### Using `PluginPage` in a backwards-compatible way

If you want to maintain backwards-compatibility with older versions of Grafana, one way is to implement a `PluginPage` wrapper. If `PluginPage` is available and the `topnav` feature is enabled then use the real `PluginPage`, otherwise fallback to whatever each plugin is doing today (including calling `onNavChanged`).

Example:

```tsx
import { PluginPageProps, PluginPage as RealPluginPage, config } from '@grafana/runtime';

export const PluginPage = RealPluginPage && config.featureToggles.topnav ? RealPluginPage : PluginPageFallback;

function PluginPageFallback(props: PluginPageProps) {
  return props.children;
}
```

There’s an additional step (and if block) needed to hide/show tabs depending on if `config.features.topnav` is `true`. These changes will need to be made in the `useNavModel.ts` file in your plugin:

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

## Forwarded HTTP headers in grafana-plugin-sdk-go

It's recommended to use the `<request>.GetHTTPHeader` or `<request>.GetHTTPHeaders` methods when retrieving forwarded HTTP headers. See [Forward OAuth identity for the logged-in user]({{< relref "add-authentication-for-data-source-plugins.md#forward-oauth-identity-for-the-logged-in-user" >}}), [Forward cookies for the logged-in user
]({{< relref "add-authentication-for-data-source-plugins.md#forward-cookies-for-the-logged-in-user" >}}) or [Forward user header for the logged-in user]({{< relref "add-authentication-for-data-source-plugins.md#forward-user-header-for-the-logged-in-user" >}}) for example usages.

### Technical details

The grafana-plugin-sdk-go [v0.147.0](https://github.com/grafana/grafana-plugin-sdk-go/releases/tag/v0.147.0) introduces a new interface [ForwardHTTPHeaders](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go@v0.147.0/backend#ForwardHTTPHeaders) that `QueryDataRequest`, `CheckHealthRequest` and `CallResourceRequest` implements.

Newly introduced forwarded HTTP headers in Grafana v9.4.0 are `X-Grafana-User`, `X-Panel-Id`, `X-Dashboard-Uid`, `X-Datasource-Uid` and `X-Grafana-Org-Id`. Internally these are prefixed with `http_` and sent as `http_<HTTP header name>` in [CheckHealthRequest.Headers](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go@v0.147.0/backend#CheckHealthRequest) and [QueryDataRequest.Headers](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go@v0.147.0/backend#QueryDataRequest). By using the [ForwardHTTPHeaders](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go@v0.147.0/backend#ForwardHTTPHeaders) methods you're guaranteed to be able to operate on HTTP headers without using the prefix, i.e. `X-Grafana-User`, `X-Panel-Id`, `X-Dashboard-Uid`, `X-Datasource-Uid` and `X-Grafana-Org-Id`.