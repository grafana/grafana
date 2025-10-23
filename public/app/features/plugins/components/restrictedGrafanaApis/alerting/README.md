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
