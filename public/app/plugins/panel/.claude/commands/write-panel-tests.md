# Write Unit Tests for a Grafana Panel Plugin

You are helping write unit tests for a Grafana panel plugin using Jest + React Testing Library. Follow the patterns established in the heatmap and histogram panel plugins.

## Step 1: Gather context

Before writing any tests, read the relevant files:

```bash
# Find existing tests in the plugin
find public/app/plugins/panel/<plugin-name> -name "*.test.*"

# Find the main panel component
ls public/app/plugins/panel/<plugin-name>/

# Check code coverage for uncovered lines
yarn jest --coverage --collectCoverageFrom="public/app/plugins/panel/<plugin-name>/**/*.{ts,tsx}" public/app/plugins/panel/<plugin-name>/
```

Read:

- The panel component being tested (e.g. `FooPanel.tsx`)
- The generated options type (`panelcfg.gen.ts`)
- `public/app/plugins/panel/test-utils.ts` — shared `getPanelProps` helper
- `public/app/plugins/panel/<plugin-name>/AGENTS.md` if present for plugin-specific rules
- `public/app/plugins/panel/AGENTS.md` for general plugin rules
- Any existing test files in the plugin for established patterns

## Step 2: Project conventions

### Imports

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataFrame, FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { FooPanel } from './FooPanel';
import { defaultOptions, Options } from './panelcfg.gen';
```

Merge imports from the same module into a single statement. ESLint will flag duplicates.

### Required mocks

**uPlot** — only mock if used. Mock only the parts you need. Capture config for test assertions:

```typescript
let lastUPlotConfig: { width: number; height: number } | null = null;

jest.mock('uplot', () => {
  const mockPathsBars = jest.fn(() => () => '');

  return jest.fn().mockImplementation((config: { width?: number; height?: number }) => {
    lastUPlotConfig = { width: config?.width ?? 0, height: config?.height ?? 0 };
    return {
      setData: jest.fn(),
      setSize: jest.fn(),
      destroy: jest.fn(),
      paths: { bars: mockPathsBars },
      rangeLog: jest.fn((min: number, max: number) => [min, max]),
    };
  });
});
```

**@grafana/ui** — mock only the parts you need. Prefer `jest.requireActual` spread:

```typescript
jest.mock('@grafana/ui', () => {
  return {
    ...jest.requireActual('@grafana/ui'),
    TooltipPlugin2: MockTooltipPlugin2,
    VizLayout: MockVizLayout,
  };
});
```

### Module-level test state flags

Use module-level `let` variables for test-controlled state. Reset them in `beforeEach`:

```typescript
let canExecuteActionsForTest = false;
let lastUPlotConfig: { width: number; height: number } | null = null;

describe('FooPanel', () => {
  beforeEach(() => {
    canExecuteActionsForTest = false;
    lastUPlotConfig = null;
  });
});
```

## Step 3: DataFrame factory helpers

Create focused factory functions with JSDoc. Prefer narrow overrides over God-object params:

```typescript
/**
 * Creates a minimal DataFrame for FooPanel tests.
 * @param overrides - Optional overrides for time and value fields
 */
function createFooFrame(overrides?: { timeValues?: number[]; values?: number[] }) {
  const timeValues = overrides?.timeValues ?? [1000, 2000, 3000];
  const values = overrides?.values ?? [10, 20, 30];
  return toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues },
      { name: 'value', type: FieldType.number, values, config: { unit: 'short' } },
    ],
  });
}
```

**DataFrame Field type correctness:** Numeric values must use `FieldType.number`. Using the wrong or undefined `FieldType` in mocked DataFrame will cause bugs and unexpected behavior.

**`stampFrameWithDisplay`** — adds display processors so formatted values work in tooltip tests:

```typescript
function stampFrameWithDisplay(frame: DataFrame): DataFrame {
  frame.fields.forEach((field) => {
    if (!field.display) {
      field.display = getDisplayProcessor({ field, theme });
    }
  });
  return frame;
}
```

**Specialized factories:** Create targeted factories for each data variant:

- `createFooFrameWithLinks(linkConfig)` — DataLinks
- `createFooFrameWithActions(actionConfig)` — field actions
- `createFooFrameWithLabels(overrides)` — labeled fields
- `createExemplarFrame(overrides)` — exemplar data
- `createAnnotationFrame(overrides)` — annotation data

## Step 4: Render helper

Create a single `render` helper scoped to the `describe` block:

```typescript
describe('FooPanel', () => {
  /**
   * Renders FooPanel with the given data and options.
   *
   * @param dataOverrides - Override series or annotations
   * @param optionsOverrides - Override panel options
   */
  function renderFooPanel(
          dataOverrides?: Partial<{ series: DataFrame[]; annotations?: DataFrame[] }>,
          optionsOverrides?: Partial<Options>
  ) {
    const mergedOptions = { ...defaultPanelOptions, ...optionsOverrides };
    const props = getPanelProps<Options>(mergedOptions, {
      data: {
        state: LoadingState.Done,
        series: [createFooFrame()],
        timeRange: getDefaultTimeRange(),
        ...dataOverrides,
      },
    });
    return render(<FooPanel {...props} />);
  }
```

**Immediate chart render:** VizLayout only renders the chart after measuring the legend. Use `showLegend: false` in tests where legend measurement isn't the focus, or use `waitFor` when you need the chart to appear with legend shown.

## Step 5: Test structure

Use `describe` groups that mirror product features, not implementation details. Use behavior-focused names, not line numbers:

```typescript
describe('FooPanel', () => {
  it('renders visualization when data is valid', () => { ... });
  it('shows error/empty state when series is empty', () => { ... });

  describe('Options', () => {
    describe('legend', () => {
      it('displays legend when legend.show is true', () => { ... });
      it('hides legend when legend.show is false', () => { ... });
    });
  });

  describe('Tooltip', () => {
    it('renders tooltip content in Multi mode', () => { ... });
    it('does not show count when seriesIdx mismatches in Single mode', () => { ... });
  });

  describe('Regression', () => {
    // PR #93254 — empty heatmap should not render cell content in tooltip
    it('does not render cell content for empty heatmap data', () => { ... });
  });
});
```

**Counter-example tests:** Always pair positive tests with negative counterparts to lock in filtering behavior:

```typescript
it('renders count when seriesIdx matches count field in Single mode', () => { ... });
it('does not show count when seriesIdx does not match count field in Single mode', () => { ... });
```

**Regression tests:** Create a dedicated `describe('Regression', ...)` block for bug-fix tests. Include the PR number in a comment. Temporarily revert the fix to confirm the test fails without it.

## Step 6: Assertion patterns

**Visibility over existence:**

```typescript
// Prefer
expect(screen.getByTestId('foo-container')).toBeVisible();
// Over
expect(screen.getByTestId('foo-container')).toBeInTheDocument();

// For "not present":
expect(screen.queryByTestId('foo-container')).not.toBeInTheDocument();
```

**Use `@grafana/e2e-selectors`** for stable test IDs:

```typescript
import { selectors } from '@grafana/e2e-selectors';
expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
```

**Prefer `toEqual` over inequality assertions:**

```typescript
// Prefer — stable, debuggable
expect(result).toEqual([1, 8]);
// For large objects like DataFrame
expect(result).toMatchSnapshot();

// Avoid — fragile, hard to debug
expect(result[0]).toBeLessThan(2);
expect(result[1]).toBeGreaterThan(7);
expect(result).toMatchObject(objectContaining(expect.any));
```

When the expected value is unknown, use a temporary failing assertion to capture the actual value, then replace with `toEqual`.

**Structural assertions for conditional UI:**

```typescript
const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);
```

**Content assertions over container-only checks:**

```typescript
// Weak — only checks container exists
expect(screen.getByTestId(tooltipWrapper)).toBeInTheDocument();

// Strong — verifies actual content
expect(screen.getByText('Bucket: 0 - 1')).toBeVisible();
```

## Step 7: Pure utility / non-component testing

Many panel plugins have utility functions (path builders, scale logic, config builders) that can be tested without React rendering.

**Config builder extraction helpers** — extract and invoke uPlot config callbacks directly:

```typescript
/**
 * Extracts the y-scale range function and scale key from a UPlotConfigBuilder.
 * Throws if the scale or range function is missing.
 */
function getYScaleRangeInfo(builder: UPlotConfigBuilder) {
  const yScale = builder.scales.find((s) => s.props.scaleKey !== 'x');
  if (!yScale) throw new Error('No y scale found');
  const range = yScale.props.range;
  if (typeof range !== 'function') throw new Error('Range is not a function');
  return { range, scaleKey: yScale.props.scaleKey };
}
```

## Step 8: TypeScript rules

- **Avoid non-null assertions** (`!`) — use runtime guards instead:
  ```typescript
  if (!info) throw new Error('Expected info');
  ```
- **Avoid type assertions** (`as Foo`) — use typed factory helpers:
  ```typescript
  // Instead of: const u = { height: 100 } as uPlot;
  const u = createMinimalUPlot(scaleKey, { height: 100 });
  ```
- Use `@ts-expect-error` (not `@ts-ignore`) with a comment when mocking schema gaps:
  ```typescript
  tooltip: {
    mode: TooltipDisplayMode.Single,
    // @ts-expect-error sort not in mocked schema
    sort: 'none',
  }
  ```
- Use runtime checks for callable properties:
  ```typescript
  if (typeof info.splits !== 'function') throw new Error('splits is not callable');
  ```
- Use `Array.isArray()` for safe array checks instead of type assertions in mocks
- Type factory return values explicitly when used in multiple places:
  ```typescript
  const frame: DataFrame = createFooFrame();
  ```

## Step 9: Property audit

After writing tests, audit object literals and remove properties that:

- Don't cause type errors when removed
- Don't affect existing test assertions
- Duplicate defaults that `getPanelProps` or `defaultOptions` already provide

This keeps test data minimal and intent clear.

## Step 10: Run and verify

```bash
# Check for type errors
yarn typecheck

# Fix ESLint errors
yarn eslint public/app/plugins/panel/<plugin-name>/ --fix

# Run the plugin's tests with coverage to find uncovered lines
yarn jest --watchAll=false --coverage \
  --collectCoverageFrom="public/app/plugins/panel/<plugin-name>/**/*.{ts,tsx}" \
  public/app/plugins/panel/<plugin-name>/
```

Target >90% coverage on business logic. Focus new tests on uncovered lines in the current branch diff.

## Quick checklist

### Critical

- [ ] `toEqual` preferred over `toBeLessThan` / `toBeGreaterThan`
- [ ] Content assertions, not just container-existence checks
- [ ] Counter-example tests for filtering / conditional behavior
- [ ] Coverage run confirms no regression on changed lines
- [ ] Address and fix all type errors

### Clean up high impact debt

- [ ] Run ESLint fix: `yarn eslint path/to/test-file.test.tsx --fix`
- [ ] Run typecheck and fix type errors: `yarn typecheck` (or `yarn exec tsc --noEmit`)
- [ ] No `!` or `as Type` assertions — use runtime guards and typed factories

### Refactor

- [ ] `getPanelProps` used for all panel renders
- [ ] Test utility methods have JSDoc
- [ ] Module-level state flags reset in `beforeEach`
- [ ] Tests grouped by feature in `describe` blocks with behavior-focused names
- [ ] Regression tests in a dedicated `describe('Regression', ...)` block with PR numbers
- [ ] Temporarily revert fix PRs to assert that regression tests fail without the fix implementation
- [ ] `@grafana/e2e-selectors` used for test IDs where available

## Additional checklist if plugin uses uPlot

- [ ] `MockVizLayout` used if tests depend on canvas dimensions or legend height

## Common pitfalls (from past sessions)

| Mistake                               | Fix                                                                  |
| ------------------------------------- | -------------------------------------------------------------------- |
| `FieldType.time` for numeric data     | Use `FieldType.number` — `buildHistogram` ignores non-numeric fields |
| `state: 'Done'` in PanelData          | Use `LoadingState.Done` from `@grafana/data`                         |
| `timeRange: { from: 0, to: 0 }`       | Use `getDefaultTimeRange()` from `@grafana/data`                     |
| `createRef()` + assignment            | Use `{ current: value }` — `RefObject.current` is readonly           |
| Duplicate imports from same module    | Merge into single import statement                                   |
| Rendering-only regression test passes | Invoke the fixed callback directly to hit the bug path               |
| `@ts-ignore`                          | Use `@ts-expect-error` with a descriptive comment                    |
