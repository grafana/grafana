# Logging Framework

A centralized logger registry built on top of [Grafana Faro Web SDK](https://github.com/grafana/faro-web-sdk). It provides type-safe, source-scoped loggers that forward to the Faro collector, with optional console output for local debugging.

## Key concepts

- **`Loggers`** — a `satisfies Record<string, LoggerDefaults>` object in `loggers.ts` that defines every valid logger source and its defaults (context, console output). Adding an entry here is all that's needed to register a new logger.
- **`LoggerSource`** — `keyof typeof Loggers`, automatically derived from the keys of the `Loggers` object.
- **Logger registry** — singleton record that stores one `MonitoringLogger` per source. Initialized once at app boot via `initializeLoggersRegistry()`, which iterates over `Loggers` automatically.
- **`MonitoringLogger`** — object with five methods: `logDebug`, `logInfo`, `logWarning`, `logError`, `logMeasurement`.

## How to add a new logger

1. **Add an entry to the `Loggers` object** in `loggers.ts`. Follow the naming convention `grafana.<area>.<feature>`:

   ```ts
   export const Loggers = {
     'grafana/runtime.plugins.meta': { logToConsole: true },
     'grafana/runtime.utils.getCachedPromise': {},
     'grafana.dashboard.panels': { context: { team: 'dashboards' }, logToConsole: true }, // ← add your source
   } satisfies Record<string, LoggerDefaults>;
   ```

   That's it — `LoggerSource` updates automatically and `initializeLoggersRegistry()` will pick it up.

2. **Use it** anywhere in the codebase:

   ```ts
   import { getLogger } from '@grafana/runtime/unstable';

   const logger = getLogger('grafana.dashboard.panels');
   logger.logInfo('something happened', { extra: 'context' });
   ```

## Usage examples

### Basic logging

```ts
import { getLogger } from '@grafana/runtime/unstable';

const logger = getLogger('grafana/runtime.plugins.meta');
logger.logDebug('cache miss for plugin metadata');
logger.logInfo('plugin loaded successfully', { pluginId: 'grafana-clock-panel' });
logger.logWarning('deprecated API used', { type: 'panel' });
logger.logError(new Error('plugin failed to load'), { pluginId: 'my-plugin' });
```

### Measurements

```ts
logger.logMeasurement('page_load', { duration: 1234, ttfb: 200 }, { route: '/dashboards' });
```

### Console output

Set `logToConsole: true` in the `Loggers` entry to also write to the browser console (useful during development). This wraps each log method so it calls both Faro and the corresponding `console.*` method.

```ts
'grafana.area.myFeature': { logToConsole: true },
```

### Default context

You can attach context that will be merged into every log call for that logger:

```ts
'grafana.area.myFeature': { context: { team: 'platform' } },
```

## API

### `initializeLoggersRegistry()`

Creates a logger for every entry in the `Loggers` object and stores it in the registry. Called once at app boot (in `app.ts`).

### `getLogger(source: LoggerSource): MonitoringLogger`

Returns the logger for the given source. If the registry hasn't been initialized yet, it logs a warning to the console and:

- In **development** (`NODE_ENV=development`): throws an error.
- In **production / test**: returns a fallback logger (not stored in the registry) so the caller doesn't crash.

### `setLogger(source: LoggerSource, logger: MonitoringLogger): void`

Replaces a logger's entry in the registry. **Test-only** — throws if `NODE_ENV` is not `test`. Prefer using `mockLogger` from `@grafana/test-utils/unstable` instead of calling this directly.

### `clearLoggerRegistry()`

Empties the entire registry. **Test-only** — throws if `NODE_ENV` is not `test`.

## Mocking loggers in tests

Use `mockLogger` from `@grafana/test-utils/unstable` to replace a logger with `jest.fn()` stubs. This prevents tests from hitting the real Faro SDK and lets you assert on log calls.

````ts
import { type MonitoringLogger } from '@grafana/runtime';
import { mockLogger } from '@grafana/test-utils/unstable';

let logger: MonitoringLogger;

beforeEach(() => {
  logger = mockLogger('grafana/runtime.plugins.meta');
});

it('should log a warning when something unexpected happens', () => {
  doSomethingThatWarns();

  expect(logger.logWarning).toHaveBeenCalledWith(
    'unexpected thing happened',
    expect.objectContaining({ type: 'panel' })
  );
});

it('should log an error on failure', () => {
  doSomethingThatFails();

  expect(logger.logError).toHaveBeenCalledTimes(1);
  expect(logger.logError).toHaveBeenCalledWith(expect.any(Error));
});```

> **Note:** `mockLogger` calls `setLogger` under the hood, which throws if called outside of `NODE_ENV=test`.
````
