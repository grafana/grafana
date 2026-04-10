---
name: e2e-testing
description: Write Playwright E2E tests for the Grafana panel plugin. Use when testing user workflows, browser interactions, and visual rendering. Follows @grafana/plugin-e2e patterns with test.step() organization and data-testid selectors.
compatibility: Requires Playwright, @grafana/plugin-e2e, Docker
metadata:
  framework: playwright
  version: '1.0'
---

# E2E Testing Guidelines

Write Playwright E2E tests for critical user workflows in the Grafana Graphviz Panel.

## ⚠️ Read First: Critical Skills

**Before writing or modifying E2E tests:**

1. **[Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md)** - Failing tests catch regressions, investigate before modifying
2. **[Playwright Timing & Stability Best Practices](../playwright-timing-and-stability/SKILL.md)** - Essential patterns to prevent flaky tests in React apps

These skills will save you hours of debugging.

## Framework & Commands

- **Framework**: Playwright with @grafana/plugin-e2e
- **Run E2E**: `npm run e2e` (Docker-based, runs server + tests)
- **Debug tests (LLM-friendly)**: `.opencode/skills/e2e-testing/scripts/test-debug.sh` (verbose CLI output, no HTML)
- **Run server**: `npm run server` (required for debug script)
- **Test location**: `e2e/specs/*.spec.ts`

### LLM-Friendly Test Debugging

When investigating test failures or debugging, use the provided script for optimal CLI output:

```bash
# Start Grafana server first (in separate terminal)
npm run server

# Run all tests with verbose output
.opencode/skills/e2e-testing/scripts/test-debug.sh

# Run specific test file
.opencode/skills/e2e-testing/scripts/test-debug.sh e2e/specs/panel.spec.ts

# Run tests matching pattern
.opencode/skills/e2e-testing/scripts/test-debug.sh --grep "Builder mode"

# Run single test by line number
.opencode/skills/e2e-testing/scripts/test-debug.sh e2e/specs/panel.spec.ts:40
```

This script provides:

- List reporter for line-by-line test output
- Sequential execution (--workers=1) for deterministic output
- No retries (--retries=0) for immediate failure visibility
- No HTML/monocart reports cluttering output
- Fast feedback for debugging

**Important**: The debug script requires Grafana server running separately. Use `npm run e2e` for full automated runs.

## Test Structure

### Use test.step() for Readable Tests

Organize tests into clear steps using `test.step()`:

```typescript
test('Feature name - displays expected behavior', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  await test.step('Navigate to panel', async () => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    await gotoPanelEditPage({ dashboard, id: '1' });
  });

  await test.step('Verify element is visible', async () => {
    await expect(page.getByTestId('element-id')).toBeVisible();
  });

  await test.step('Interact with UI', async () => {
    await page.getByRole('button', { name: 'Action' }).click();
    await expect(page.getByText('Expected Result')).toBeVisible();
  });
});
```

### Test Organization Patterns

**Constants at top:**

```typescript
const DASHBOARD_FILES = {
  DEFAULT: 'dashboard.json',
  PANEL_STATES: 'panel-states.json',
} as const;

const PANEL_IDS = {
  VALID_PANEL: '1',
  EMPTY_PANEL: '2',
} as const;

const TEST_IDS = {
  PANEL_RENDERED: 'graphviz-panel-rendered',
  PANEL_SVG: 'graphviz-panel-rendered-svg',
} as const;
```

## Selectors

**Priority order:**

1. **data-testid** - Most stable

   ```typescript
   page.getByTestId('graphviz-panel-rendered');
   ```

2. **Role + Name** - Semantic, accessible

   ```typescript
   page.getByRole('button', { name: 'Add Node' });
   ```

3. **Text** - Use regex for flexibility

   ```typescript
   page.getByText(/empty diagram/i);
   ```

4. **Avoid CSS selectors** - Fragile, break on styling changes

## Grafana Plugin E2E Fixtures

Use @grafana/plugin-e2e fixtures:

- `gotoPanelEditPage` - Navigate to panel edit mode
- `readProvisionedDashboard` - Load provisioned dashboard JSON
- `page` - Standard Playwright page object

## Assertions

**Wait for visibility:**

```typescript
await expect(element).toBeVisible();
await expect(element).not.toBeVisible();
```

**Use timeouts for slow renders:**

```typescript
await expect(svg).toBeVisible({ timeout: 5000 });
```

**Check SVG content:**

```typescript
const svg = page.getByTestId('panel-svg').locator('svg');
await expect(svg.locator('text').filter({ hasText: 'Node Name' })).toBeVisible();
```

## What to E2E Test

Focus on:

- Critical user workflows (creating diagrams, editing nodes)
- Visual rendering (SVG appears, nodes visible)
- Error states (invalid diagrams show errors)
- Mode switching (Builder, Code, Query modes)
- Real browser interactions (clicks, typing, modals)

Avoid:

- Pure logic (test with unit tests)
- Every edge case (use unit tests)
- Implementation details (internal state)

## Common Patterns

### Testing Empty States

```typescript
await test.step('Verify empty state message', async () => {
  await expect(page.getByText(/empty diagram/i)).toBeVisible();
});

await test.step('Verify action button available', async () => {
  await expect(page.getByRole('button', { name: 'Add Node' })).toBeVisible();
});
```

### Testing Form Interactions

```typescript
await test.step('Fill form', async () => {
  await page.getByTestId('node-form-id-input').fill('NodeID');
  await page.getByTestId('node-form-label-input').fill('Node Label');
});

await test.step('Submit form', async () => {
  await page.getByRole('button', { name: 'Add Node' }).click();
});
```

### Testing Monaco Editor

```typescript
await test.step('Type in Monaco editor', async () => {
  const textarea = page.locator('textarea.inputarea').first();
  await textarea.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.insertText('digraph G { A -> B; }');
});

await test.step('Trigger save', async () => {
  await page.getByText('Layout engine').click();
  await page.waitForTimeout(1000);
});
```

## Test Naming

Use descriptive names that explain the workflow:

```typescript
test('Builder mode - Valid diagram - displays diagram with nodes', async () => {});
test('Code mode - Empty diagram - displays empty message with code example', async () => {});
test('Query mode - Invalid diagram - displays error message', async () => {});
```

Format: `[Mode] - [State] - [Expected Behavior]`

## Docker Setup

E2E tests run in Docker with Grafana server:

- `npm run e2e` - Builds and runs everything
- `docker compose up --build` - Manual server start
- Tests run against `http://localhost:3000`

## Coverage

E2E tests contribute to overall coverage via monocart-reporter. Run `npm run coverage` to merge unit + e2e coverage reports.

## Common Corrections

1. **Read [Playwright Timing & Stability](../playwright-timing-and-stability/SKILL.md)** - Essential patterns for stable tests
2. **Read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md)** before modifying tests
3. **Always use test.step()** for clear test organization
4. **Prefer data-testid selectors** over CSS selectors
5. **Always verify visibility before interaction** - `await expect(element).toBeVisible(); await element.click();`
6. **Test user workflows, not implementation** - Focus on behavior
7. **Avoid artificial timeouts** - Wait for actual DOM state changes with `waitForFunction()`
