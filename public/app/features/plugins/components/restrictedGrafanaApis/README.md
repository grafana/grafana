# Restricted Grafana APIs

The APIs available here are used to be only shared with certain plugins using the `RestrictedGrafanaApisContextProvider`.

### FAQ

**When should I use it to expose an API?**
If you only would like to share functionality with certain plugin IDs.

**How to add an API to the list?**

1. Add the API to a separate file under `public/app/features/plugins/components/restrictedGrafanaApis/`
2. Reference the API in the `restrictedGrafanaApis` variable in `public/app/features/plugins/components/restrictedGrafanaApis/RestrictedGrafanaApisProvider.tsx`
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
An app plugin's module code runs when Grafana loads the plugin, before any of its roots (the app pages, its
extension components) mounts. `useRestrictedGrafanaApis()` only works inside those roots. Code that has to run
from the start, such as a listener that should exist on every page, can ask for the APIs while the module loads
with `AppPlugin.onRestrictedApis`. Use the hook everywhere else.

```ts
import { AppPlugin } from '@grafana/data';

export const plugin = new AppPlugin();

// Older Grafana versions have no `onRestrictedApis`: check before calling it.
if (typeof plugin.onRestrictedApis === 'function') {
  plugin.onRestrictedApis(({ addPanel }) => {
    // Called once, after the module has loaded.
  });
}
```

The contract:

- Call `onRestrictedApis` while the module evaluates, as you call `addLink` or `addComponent`. Grafana calls each
  listener once, after the module has loaded, from the app plugin import (`pluginImporter`). A later call is never
  answered.
- Each listener gets the APIs this plugin may have, the same objects the hook returns inside its roots. A listener
  that throws is logged and does not fail the plugin's load.
- Feature-detect it: on Grafana versions without it, the method does not exist.

What it does not change: existing plugins and the hook work as before. A plugin that does not call
`onRestrictedApis` costs nothing at load: the resolver is only loaded for plugins that ask, which pay one small
lookup.

Differences from the hook:

- An API that exists only behind a feature flag is included if the flag is on when the plugin loads, and the set
  is not updated afterwards. Such APIs must check their flag on every call, so a stale handle refuses instead of
  acting.
- APIs tied to a mounted root are not included. Today that is the Dashboard Mutation API, which acts on what the
  plugin's roots show.

Why it keeps the security model: the APIs are resolved for the id Grafana loaded the module for, never an id
the plugin supplies, and through the same allow and block lists as the hook. Both use one filter,
`getAllowedRestrictedGrafanaApis`. The provider and the load path read one list of APIs,
`restrictedGrafanaApis.ts`, so an API added there reaches both in the same way.
