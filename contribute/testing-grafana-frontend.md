# Grafana frontend testing conventions

Grafana-specific conventions. Read only the section relevant to the task.

## Running Playwright E2E tests

Use `pnpm e2e:playwright <spec>` with `GRAFANA_URL` unset by default. The harness starts
its own lightweight Grafana server on port 3001; this is more efficient than starting a
separate development instance. Do not start `make run` or another Grafana server just to
run E2E tests.

Only set `GRAFANA_URL` to use a custom server when the task specifically needs one, such as
debugging a particular running instance or testing a deployment. State that reason before
using the override. Setting `GRAFANA_URL` disables the harness-managed server, so the target
instance must already be running and accessible.

## Mocking and feature flags

To type a mocked function or module, use `jest.mocked(fn)` — never
`fn as jest.MockedFunction<typeof fn>` (or `as jest.Mocked<…>`). `jest.mocked` is the
type-safe, less noisy repo convention and gives typed access to `.mock` / `.mockReturnValue`:

```ts
import { measureText } from '@grafana/ui';
jest.mock('@grafana/ui', () => ({ ...jest.requireActual('@grafana/ui'), measureText: jest.fn() }));

const measureTextMock = jest.mocked(measureText); // ✅ not `measureText as jest.MockedFunction<…>`
measureTextMock.mockReturnValue({ width: 100 } as TextMetrics);
expect(measureTextMock).toHaveBeenCalledWith('label', 12);
```

**Never mock `@grafana/runtime/internal` to fake a feature flag.** It bypasses the real
OpenFeature/flag-client wiring and drifts from how flags actually resolve at runtime:

```ts
// ❌ don't
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => true }),
}));
```

Use `setTestFlags` from `@grafana/test-utils/unstable` instead — it drives the real client:

```ts
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

beforeAll(() => {
  setTestFlags({ [FlagKeys.PluginsUseMTPlugins]: true });
});

afterAll(() => {
  setTestFlags({});
});
```

For classic `featuremgmt` toggles (not OpenFeature flags), use `testWithFeatureToggles`
(`config.featureToggles`) instead of mocking `@grafana/runtime`.

## Anti-flake rules

Each rule maps to a real stabilization; global Playwright config retries once in CI only.
**Avoid → Do:**

1. **Broad locators.** Avoid `page.locator('.some-widget')` when it also matches previews/
   thumbnails elsewhere on the page. Do scope to the owning container:
   `getByGrafanaSelector(Panels.Panel.content).locator('.some-widget')`.
2. **Reading DOM text + regex while state settles.** Avoid `textContent().match(/(\d+) selected/)`
   on a virtualized/animating list. Do assert the container is visible, read a stable source
   (e.g. the checkbox `input`), capture "before" once via a shared helper. _(#121757)_
3. **JSDOM modal / `elementFromPoint` hacks** (double-click, drag simulation). Do reach the state
   via a deterministic path (context-menu → "Edit" menuitem) then `waitFor` the control.
   _(#127124)_
4. **`.fill()` on contenteditable / CodeMirror.** Do `click()` to focus, then
   `pressSequentially()`; target fields by `getByLabel`. _(#127979)_
5. **Timeout flake may be a real async race.** An unsubscribed/uncleared async load can
   overwrite fresh UI with a stale response. Fix the product (cancel in-flight work, clear
   stale UI on context change) and wait for new content before interacting. _(geomap #127100)_
6. **Not waiting for React state flush.** Wrap post-interaction assertions in `waitFor`. A
   `waitFor` callback must **throw** to retry, so it needs `expect`, not a bare boolean.
   _(#124994)_
7. **Long multi-step E2E specs.** Mark `test.slow()` and add explicit load gates instead of
   leaning on default timeouts. _(#121757)_

Testing HTML5 canvas / uPlot-based visualizations, or writing panel accessibility and
interaction-snapshot E2E tests, has its own harness and additional canvas-specific anti-flake
rules — see the `panel-testing-strategy` skill.

## When to add which tests (by SDLC phase)

Tie the test layer to the feature-toggle phase:

- **Experimental** — add unit tests in **every PR** as you build (flagged-off code still
  ships to prod). Never save tests for the end.
- **Before Private/Public Preview** — the full diamond in place: E2E + a unit-coverage
  check-up. Do a **testing review**: confirm coverage is _intentional_, not merely
  _incidental_ — nothing important missing, nothing critical covered only by accident.
  Bug-bash fixes each get a regression unit test.
- **Before GA** — should be low-drama: coverage in place, e2es in place, every bug fix
  already carried a regression test. Consider integration tests and a broader E2E suite.

**Close every bug with a test** — at the layer where it should have been caught, in the
same PR as the fix. Tests land in the same PR as the feature or fix, so git history explains
why each test exists.

**A regression test must fail on `main`.** It has to fail in the absence of the fix and pass in
its presence — otherwise it isn't pinning the bug. Prove it: stash or revert the product change,
run the new test, and confirm it goes **red**; restore the fix and confirm green. A regression test
that stays green without the fix documents nothing and will not catch the bug coming back.
