---
name: frontend-testing-strategy
description: Write unit and E2E tests for Grafana frontend code (React/TypeScript, any package or feature area) to the conventions this repo expects. Use when adding, backfilling, or reviewing frontend tests; when a test only asserts "it rendered" or "it's defined"; when reviewing AI-generated tests for slop; or when a frontend test is flaky. For visualization panels and grafana-ui viz components specifically, also load the `panel-testing-strategy` skill.
---

# Frontend testing strategy

Write tests for Grafana frontend code that pass review on the first pass. Goals:
**assert concrete behavior, not existence**; keep test descriptions honest; verify the test
actually exercises the target code path; and stabilize the known flake classes. Several codeowner
paths are opted into the gating `check-frontend-test-coverage.yml` check, so coverage that drops
fails CI.

## Resolve the target

Interpret the argument to decide scope:

- **A file path** → test that file (create or extend its co-located `*.test.ts(x)`).
- **A directory / component / module name** → the source files under it lacking meaningful
  coverage.
- **"current file" / no path but a file is open** → the open file.
- **No argument** → ask which file/area; don't blanket-generate.

Prefer extending an existing co-located test file over adding a new one. Match the
surrounding test file's imports and idiom.

## Principle 1 — Where each test fits: the (inverted) testing diamond

Testing model, top to bottom:

- **E2E** (pinnacle) — validate the system via real user flows; powerful but slow, so keep
  it targeted and few.
- **Unit** (base) — cheap, plentiful specs documenting behavior for logic/utils.
- **Static analysis** (foundation) — lint + strong TypeScript interfaces.

Pick the layer that matches the job: logic/IO → unit; how pieces fit together →
integration/visual; a key user journey → E2E. **Favour speed and feedback** — unit tests
are cheap, so make them small and plentiful; reserve the expensive layers for what only
they can cover.

## Principle 2 — Assert real behavior, not existence

This is the bar reviewers hold every test to, at every layer. They reject tests that only
prove a function ran. Never land these as the whole test:

```ts
expect(result).toBeDefined(); // ❌ proves nothing about correctness
expect(result).toBeInstanceOf(Foo); // ❌ (unless the type itself is the contract)
expect(() => fn(input)).not.toThrow(); // ❌ "didn't crash" is not a behavior
expect(result).toHaveLength(input.length); // ❌ if it just mirrors the input
```

Instead assert the **concrete computed value**, so a failure points at the real bug:

```ts
// diffperc: 10 -> 20 is a +100% change
const results = getDisplayValuesForCalcs(/* … */);
expect(results[0].numeric).toBe(100); // ✅ assert the math
expect(results[0].text).toBe('100%'); // (formatting is secondary)
```

If the function mostly delegates, assert the delegation with exact arguments (see Step 2).

**Expected values are literals, not recomputations.** Never derive the expected side by calling the
code under test, a collaborator it calls internally, or by re-typing the production formula — the
test then passes whenever the code and the expectation share the same bug, and comparing a value to
_itself_ asserts nothing at all. Freeze the expected value as a literal, computed once by hand or
captured from a known-good run:

```ts
// ❌ circular: `expected` is produced the same way the code produces its result
const expected = theme.visualization.getColorByName('red');
expect(dim.value()).toBe(expected);
// ❌ re-derives the production formula — a bug in the formula is copied into `expected`
const expected = TABLE.CELL_PADDING * 2 + theme.typography.fontSize * theme.typography.body.lineHeight;
expect(getDefaultRowHeight(theme, [])).toBe(expected);

// ✅ frozen literals — a change in the resolver or the formula now fails the test
expect(dim.value()).toBe('#F2495C');
expect(getDefaultRowHeight(theme, [])).toBe(34);
```

For values awkward to write by hand (projected coordinates, hashes), assert an **independent
readback** rather than re-running the same path — e.g. project lng/lat, read it back in WGS84, and
compare to the literal input — or freeze it with `toMatchInlineSnapshot`.

**Prove the assertion has teeth.** Before landing, mutate the asserted value (or the source it
derives from) and confirm the test goes **red**. A test that stays green — because its expectation
tracks the code, or checks a value against itself — is a tautology dressed as coverage. Make this a
habit, not just the final Verify step.

## Principle 3 — Authoring with AI: no slop tests

This skill exists so AI-proposed tests meet the bar above. The failure mode to avoid is the
**slop test**:

- **Unfocused** — a wide blast of assertions that doesn't preserve the intent of the code
  under test.
- **Verbose** — unnecessary steps/mocks for a simple goal; brittle to implementation
  changes, and can silently mask real regressions.
- **Limiting** — so many, or so coupled to implementation, that a later refactor breaks them
  without telling you whether behavior actually broke. (Unreadable DOM snapshot tests are the
  classic example — never add them.)

Review AI output _thoroughly_ before opening a PR; expect to amend it for
readability/maintainability. If reviewing the AI output costs more than writing the test by
hand, write it by hand. A test is a specification a teammate — and future-you — must read
easily; value refactoring for readability over a raw coverage percentage.

## Principle 4 — Do not simply update failing tests to pass after changing behaviour, or adding a feature

When a test fails after updating functionality, behaviour or features, this is a warning that a regression was caused. Tests are meant as a safety net to catch regressions, and a failing test isn't broken -- its doing its job.

Net new functionality requires net new tests. Existing tests should be treated as a spec, and if you cause a test to fail -- STOP -- and analyze why that test fails, only after thorough analysis based on tracing real code should an existing test ever be updated.

## Step 1 — Name the test for exactly what it asserts

The `it(...)` string is triage documentation — a reviewer reads it first when a test fails,
before opening the body. Make it behavior-specific, and keep it equivalent to the assertion:

```ts
// ❌ vague, and doesn't say what "works" means
it('handles the update', () => { … });

// ✅ says exactly what is asserted
it('sets the field to disabled when the parent form is read-only', () => {
  expect(getByRole('textbox')).toBeDisabled();
});
```

Use `it.each` with `$name` / `$desc` interpolation for enumerable variants so each row
self-labels. Delete duplicate cases — if two tests exercise the same path, keep one.

**Prefer deletion over inflation.** When an assertion only restates what a stronger assertion in
the same test already covers, keep the stronger and delete the other. Removing redundant coverage
is a legitimate, reviewable improvement: a smaller honest test beats a padded one. Before
deleting, confirm the behavior is still covered by a sibling assertion or test.

## Step 2 — Verify the test reaches the target branch

- **Set the gates.** e.g. a code path that only runs when a specific option/flag is set —
  omit it and you test the plain path and cover nothing. Set every precondition the branch
  requires.
- **Assert collaboration precisely** when you deliberately don't want to test a collaborator —
  mock it and verify it's called with exact args / counts, not just that output exists:

```ts
const guess = jest.spyOn(mod, 'guessFieldTypes');
processFrames([frameA, frameB]);
expect(guess).toHaveBeenCalledTimes(2); // once per frame — use ≥2 frames
expect(getColor.mock.calls.map((c) => c[1])).toEqual([0, 2]); // skipped null at idx 1
guess.mockRestore();
```

Avoid loose assertions that pass for the wrong reason: no `toMatch(/50/)` where the exact
value is knowable; no `toBeGreaterThanOrEqual` where the code guarantees a strict change
(use `toBeGreaterThan`). Confine any external-interface cast to one helper rather than
sprinkling `@ts-expect-error`.

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

## Step 3 — Don't test what shouldn't exist

- **Skip modules slated for deletion.** Adding tests to deprecated code signals it's
  load-bearing and obstructs its removal. If unsure, ask.
- Deferring comprehensiveness to a follow-up PR is acceptable — leave an explicit note
  rather than shipping a shallow test that looks complete.

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

## Rules checklist

Pointers to the sections above — read them for the detail:

- Principle 2 — assert concrete values / exact call args; never bare `toBeDefined`,
  `instanceof`, "did not throw", or length-mirrors-input. Expected values are frozen literals, never
  recomputed from the code under test; mutate the value and confirm red before landing.
- Principle 3 — no unfocused/verbose/implementation-coupled slop; review AI output before a PR.
- Principle 4 — a failing test after a behavior change is a regression signal, not something to
  patch over; net new functionality needs net new tests.
- Step 1 — `it(...)` equivalent to the assertion; `it.each` for variants, delete duplicates.
- Step 2 — verify the test reaches the target branch (set gates); type mocks with
  `jest.mocked(fn)`, never `as jest.MockedFunction<…>`.
- Step 3 — no tests for code slated for deletion.
- Anti-flake — apply all 7 rules.
- SDLC — tests land in the same PR as the feature/fix; close every bug with a regression test that
  fails on `main` (red without the fix, green with it).

## Exemplar files

- Spy-per-frame, untyped-input inference, distinct loading cases:
  `packages/grafana-data/src/dataframe/processDataFrame.test.ts`

See also the `panel-testing-strategy` skill (visualization/canvas-specific practices built on top
of this one), the `add-e2e-selectors` skill, `contribute/style-guides/testing.md`,
`contribute/style-guides/e2e-playwright.md`, and
`packages/grafana-e2e-selectors/src/selectors/README.md`.

## Verify

- `yarn test <path>` (add `--watchAll=false`) — the new tests pass and actually fail when the
  asserted value is broken (mutate the expected value once to confirm it's not a no-op).
- For E2E: `yarn e2e:playwright <spec>` (it starts its own server).
- `yarn typecheck` if selectors or casts were added.
