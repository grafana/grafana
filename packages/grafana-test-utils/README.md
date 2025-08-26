# Grafana test utils

This package is a collection of test utils and a mock API (using MSW) for use with core Grafana UI development.

## Matchers

To add the matchers to your Jest config, import them then extend `expect`. This should be done in the `setupFilesAfterEnv` file declared in `jest.config.{js,ts}`.

```ts
// setupTests.ts
import { matchers } from '@grafana/test-utils';

expect.extend(matchers);
```

Included in this package are the following matchers:

### `toEmitValues`

Tests that an Observable emits the expected values in the correct order. This matcher collects all emitted values (including errors) and compares them against the expected array using deep equality.

### `toEmitValuesWith`

Tests that an Observable emits values that satisfy custom expectations. This matcher collects all emitted values and passes them to a callback function where you can perform custom assertions.
