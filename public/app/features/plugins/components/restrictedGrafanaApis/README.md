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
