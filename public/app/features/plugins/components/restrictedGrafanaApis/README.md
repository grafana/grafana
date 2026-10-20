# Restricted Grafana APIs

The APIs available here are used to be only shared with certain plugins using the `RestrictedGrafanaApisContextProvider`.

### FAQ

**When should I use it to expose an API?**
If you only would like to share functionality with certain plugin IDs.

**How to add an API to the list?**

1. Add the API to a separate file under `public/app/features/plugins/components/restrictedGrafanaApis/`
2. Add the API to `sharedApis` in `public/app/features/plugins/components/restrictedGrafanaApis/restrictedGrafanaApis.ts`.
3. Update the `RestrictedGrafanaApisContextType` type under `packages/grafana-data/src/context/plugins/RestrictedGrafanaApis.tsx`

**How to share an API with plugins?**
Enabling plugins is done via the Grafana config (config.ini).

**Enabling APIs for a plugin**

```ini
[plugins.restricted_apis_allowlist]
# This will share the `addPanel` api with app plugins that either have an id of "myorg-test-app"
addPanel = "myorg-test-app
```

**Disabling APIs for a plugin**

```ini
[plugins.restricted_apis_blocklist]
# This is not sharing the `addPanel` api with app plugins that either have an id of "myorg-test-app"
addPanel = "myorg-test-app"
```

**How to use restricted APIs in a plugin?**
You should be access the restricted APIs in your plugin using the `useRestrictedGrafanaApis()` hook:

```ts
import { RestrictedGrafanaApisContextType, useRestrictedGrafanaApis } from "@grafana/data";

// Inside a component
const { addPanel } = useRestrictedGrafanaApis();

// Make sure you cater for scenarios where the API is not available
if (addPanel) {
    addPanel({ ... });
}
```

**How to use restricted APIs outside a component (app plugins only)?**
`useRestrictedGrafanaApis()` works only inside an app page or an extension component. For code that runs when Grafana loads the plugin, use `AppPlugin.onRestrictedApis()`:

```ts
import { AppPlugin } from '@grafana/data';

export const plugin = new AppPlugin();

// Older Grafana versions do not have onRestrictedApis.
if (typeof plugin.onRestrictedApis === 'function') {
  plugin.onRestrictedApis(({ extensionSidebar }) => {
    if (extensionSidebar?.canFloat()) {
      extensionSidebar.setPresentation('floating');
    }
  });
}
```

- Call `onRestrictedApis()` in the file that creates the `AppPlugin`.
- To use the APIs in other files, pass them on from the listener, for example to a function that the other file exports. Do not import `plugin` into other files to call `onRestrictedApis()`. If that call runs before `plugin` exists, the plugin fails to load.
- Grafana calls each listener one time, after the plugin loads. Grafana ignores listeners that you add after the plugin loads.
- The listener gets the same APIs as the hook, with the same allow list and block list. The Dashboard Mutation API is the exception: it acts on what the plugin's mounted pages show, so only the hook has it.
- If a listener throws an error, Grafana will log the error and continue to load the plugin.
