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

## Navigate to Alert Form Schema API

The `navigateToAlertFormSchema` API provides a Zod schema for navigating to the Grafana alert form with pre-filled data. This API is useful for plugins that need to validate data before navigating to the alert creation form.

### Available Schema

- `navigateToAlertFormSchema` - Schema for data used to navigate to the alert form with pre-filled values

### Usage Example

```ts
import { useRestrictedGrafanaApis } from "@grafana/data";

function MyAlertingPlugin() {
  const { navigateToAlertFormSchema } = useRestrictedGrafanaApis();

  const validateAndNavigateToAlertForm = (data: unknown) => {
    if (!navigateToAlertFormSchema) {
      console.warn('Navigate to alert form schema API not available');
      return;
    }

    // Validate using the navigate to alert form schema
    const result = navigateToAlertFormSchema.safeParse(data);

    if (result.success) {
      console.log('Valid navigation data:', result.data);
      // Proceed with navigating to the alert form
    } else {
      console.error('Validation failed:', result.error.errors);
    }
  };

  return (
    <div>
      <button onClick={() => validateAndNavigateToAlertForm(someNavigationData)}>Navigate to Alert Form</button>
    </div>
  );
}
```

### Configuration

To enable the navigate to alert form schema API for specific plugins, add the following to your Grafana configuration:

```ini
[plugins.restricted_apis_allowlist]
# Allow specific plugins to access the navigate to alert form schema API
navigateToAlertFormSchema = "myorg-alerting-plugin, grafana-enterprise-.*"
```
