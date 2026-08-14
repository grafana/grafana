# plugin-e2e API Tests - Agent Instructions

## Purpose

These tests verify that `@grafana/plugin-e2e` fixtures, page models and matchers remain compatible with the latest Grafana UI. They are **not** plugin tests - they are forward-compatibility canaries. If a Grafana UI change breaks a selector or interaction pattern that `@grafana/plugin-e2e` depends on, these tests catch it before it ships.

## What to do when a test breaks

A failing test here means a Grafana UI change broke the `@grafana/plugin-e2e` testing API. This affects every plugin that uses `@grafana/plugin-e2e` for end-to-end testing. **Do not delete or skip the test** - that defeats its purpose. Instead, follow these steps in order:

### 1. Reuse the existing e2e selector in your new UI

This is the preferred fix. The `@grafana/plugin-e2e` package locates UI elements using selectors defined in `packages/grafana-e2e-selectors/src/selectors/` (see [pages.ts](../../../packages/grafana-e2e-selectors/src/selectors/pages.ts) and [components.ts](../../../packages/grafana-e2e-selectors/src/selectors/components.ts)). If you changed or replaced a UI element, apply the same `data-testid` or `aria-label` selector that the old element used. This requires no changes outside the Grafana repo.

For example, if you rebuilt the "Add panel" button, make sure the new button still uses the same selector value that the old one did. The test will pass without any other changes.

### 2. Add a new version to the selector

If the element still exists but its selector value legitimately needs to change (e.g. the `data-testid` was renamed for good reason), add a new versioned entry to the selector object. See [packages/grafana-e2e-selectors/src/selectors/README.md](../../../packages/grafana-e2e-selectors/src/selectors/README.md) for how versioned selectors work.

```typescript
// example: selector value changed in Grafana 12.5.0
const components = {
  PanelEditor: {
    content: {
      '12.5.0': 'data-testid New panel editor content',
      '11.1.0': 'data-testid Panel editor content',
      '9.5.0': 'Panel editor content',
    },
  },
};
```

**Important rules for selectors:**

- Never delete selectors. Even if unused in the Grafana repo, they may be used by external plugins.
- Only create new selectors for genuinely new UI. If you're changing existing UI that already has a selector, reuse it.
- Prefer string selectors over function selectors.

### 3. Raise a PR in plugin-e2e (last resort)

If the UI changed so fundamentally that no existing selector can be reused (e.g. an entirely new interaction flow replaced an old one), you may need to update `@grafana/plugin-e2e` itself. In this case:

1. Raise a PR in [grafana/plugin-tools](https://github.com/grafana/plugin-tools) to update the affected page model or fixture in `@grafana/plugin-e2e`.
2. Follow the [contributing guide for fixing broken test scenarios](https://github.com/grafana/plugin-tools/blob/main/packages/plugin-e2e/CONTRIBUTING.md#how-to-fix-broken-test-scenarios-after-changes-in-grafana).
3. Once the new `@grafana/plugin-e2e` version is published and updated in the Grafana repo, update the test here if needed.

This should be rare. Most UI changes can be handled by steps 1 or 2.

## Reference

- **E2E selectors**: `packages/grafana-e2e-selectors/src/selectors/` ([README](../../../packages/grafana-e2e-selectors/src/selectors/README.md))
- **`@grafana/plugin-e2e` API types**: `node_modules/@grafana/plugin-e2e/dist/index.d.ts`
- **Contributing guide**: [How to fix broken test scenarios after changes in Grafana](https://github.com/grafana/plugin-tools/blob/main/packages/plugin-e2e/CONTRIBUTING.md#how-to-fix-broken-test-scenarios-after-changes-in-grafana)
- **Playwright config**: `playwright.config.ts` (projects `admin` and `viewer`)
