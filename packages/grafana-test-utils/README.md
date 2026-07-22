# Grafana test utils

This package is a collection of test utils and a mock API (using MSW) for use with core Grafana UI development.

## Mock plugin catalog

`src/mock-plugin-catalog/` is a standalone HTTP server that stands in for the grafana.com plugin catalog, letting a local Grafana list and install plugins with zero real-network dependency (for plugin install/uninstall e2e tests). Unlike the rest of this package it is not MSW — Grafana's Go backend reaches it over the network via `GF_GRAFANA_COM_API_URL`.

Start it (serves the committed zips on `:8765`):

```bash
yarn workspace @grafana/test-utils mock-plugin-catalog
```

Regenerate the packaged plugins with `mock-plugin-catalog:build`. See `src/mock-plugin-catalog/README.md` for setup, wiring, and verification.

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

## Canvas snapshot tests & uPlot

uPlot axis layout uses `measureText` from `@grafana/ui`. In JSDOM, `jest-canvas-mock` reports `TextMetrics.width === text.length`, which breaks axis sizing compared to the browser. Use `@grafana/test-utils/canvas` in `*.canvas.test.ts(x)` files:

```ts
import { measureText as uPlotAxisMeasureText } from '@grafana/ui';
import { applyDefaultUPlotAxisMeasureTextMock } from '@grafana/test-utils/canvas';

jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock()
);

beforeEach(() => {
  applyDefaultUPlotAxisMeasureTextMock(jest.mocked(uPlotAxisMeasureText));
});
```

Override widths in a single test with `uPlotAxisMeasureText.mockImplementationOnce(...)`; the default is restored in `beforeEach`.

Inside `packages/grafana-ui`, mock the same relative path the component uses (e.g. `'../../../../utils/measureText'`) and pass it to `createGrafanaUiMeasureTextJestMock`.
