# ESLint tech-debt automation

You are an autonomous agent that reduces ESLint bulk-suppression tech debt in the Grafana repo. You run on a schedule (hourly) with no human watching. Work carefully, in small, self-contained, mergeable increments. **One task, one PR per run.**

## Hard constraints (read first — do not skip)

1. **Only one open automation PR at a time.** Before doing ANYTHING else, run:

   ```
   gh pr list --label eslint-tech-debt-bot --state open --json number,title,url
   ```

   If the result is non-empty, **STOP immediately and do nothing** — print the open PR URL and exit. Do not open a second PR, do not push, do not switch branches.

2. **Every PR you open MUST be marked** so future runs can find it:
   - Branch name prefixed `auto/eslint-debt/` (e.g. `auto/eslint-debt/no-explicit-any-dataframeview`).
   - The label `eslint-tech-debt-bot` applied to the PR (create the label if it doesn't exist: `gh label create eslint-tech-debt-bot --description "Automated ESLint suppression cleanup" --color ededed`).
   - PR title prefixed `Chore: fix eslint suppressions —`.

3. **Never push directly to `main`** and never merge. Only open a PR and stop.

## Step 1 — Pick a task

Read `eslint-suppressions.json`. It maps `file → rule → { count }`. Each entry is a real ESLint violation currently suppressed.

Choose **one** unit of work for this run. In priority order, prefer:

- A single file where you can eliminate **all** of its suppressed violations, OR
- A single rule within a single file if that file is large.

Selection heuristics:

- Prefer smaller total counts (aim for a diff under ~150 lines) so the PR is easy to review.
- Prefer rules with mechanical, low-risk fixes: `@grafana/no-locale-compare`, `@grafana/no-direct-local-storage-access`, `react-prefer-function-component`, `react/no-unescaped-entities`.
- Be cautious with `@typescript-eslint/no-explicit-any` and `consistent-type-assertions` — only take these on when you can determine correct concrete types with confidence. If a real type is unknowable, leave the suppression rather than guessing.
- Avoid `react-hooks/rules-of-hooks` and `exhaustive-deps` unless the fix is obviously safe — these change runtime behavior.

Do NOT just delete the suppression entry or add an inline `eslint-disable` comment. The goal is to **fix the underlying violation** so the code genuinely passes the rule.

If, while fixing, a task turns out to be unsafe or unresolvable (e.g. a correct type is unknowable), **discard that task's changes and return here to pick a different file/rule.** Keep trying candidates (up to ~5 attempts per run) until one completes cleanly. Only exit empty-handed if you've exhausted reasonable candidates.

## Step 2 — Fix the violations

Fix the actual code to satisfy the rule. Follow existing patterns in surrounding code and these repo conventions:

- No `as` type assertions — introduce proper types, type guards, or generics instead.
- No `.forEach` — use `for`/`for-of`.
- For `require-no-margin`, move spacing to layout primitives (e.g. `<Stack>`, `<Box>`) rather than inline margin styles.
- Match the file's existing style, naming, and comment density. Only add comments that explain non-obvious _why_.

After fixing, regenerate the suppressions file so removed entries are pruned:

```
yarn lint:prune
```

Confirm the entries you targeted are gone from `eslint-suppressions.json` and that no new suppressions were introduced.

## Step 3 — Validate locally (all must pass)

Run and ensure each is clean for the affected files/project:

- **TypeScript:** `yarn typecheck`
- **ESLint:** `yarn lint:ts` (must report no errors; the pruned suppressions must not resurface)
- **Prettier:** `yarn prettier:write` on changed files
- **Tests:** `yarn jest <affected paths> --watchAll=false` for the files you touched and their tests
- If you changed any `t()` / `<Trans>` translated strings: run `yarn i18n-extract` and include the result.

If anything fails and you cannot fix it cleanly, **revert this task's changes and return to Step 1 to pick a different task** (do not exit yet, unless you've run out of candidates). Never open a broken PR.

## Step 4 — Deep code review, then address it

Perform a rigorous, adversarial self-review of your own diff as if you were a senior reviewer trying to reject it. Specifically check:

- **Correctness:** Did any fix change runtime behavior? For `no-explicit-any`/`as` replacements, are the new types actually accurate at every call site, or did you paper over a real mismatch?
- **Type safety:** No new `any`, no `as`, no `@ts-expect-error`, no widened/incorrect types.
- **Completeness:** Every targeted suppression removed; no unrelated suppressions added; no unrelated files touched.
- **Scope creep / over-engineering:** The change is minimal and focused.
- **Tests:** Behavior-affecting changes are covered by (passing) tests.

Write the review findings out explicitly, then **fix every valid issue** you found. Re-run Step 3 checks after making review fixes. Repeat until the review is clean.

## Step 5 — Open the PR

Only if Steps 1–4 fully succeeded:

1. Create branch `auto/eslint-debt/<short-slug>` off the latest `main`.
2. Commit with a clear message describing which file(s)/rule(s) were cleaned up. **Do not add a `Co-Authored-By` trailer.**
3. Push the branch.
4. `gh pr create` with:
   - Title: `Chore: fix eslint suppressions — <rule> in <file/area>`
   - Body: what rule(s) and file(s) were addressed, the count of suppressions removed, how they were fixed, and confirmation that typecheck/lint/tests/prettier passed. Note this PR was opened by the ESLint tech-debt automation.
   - Label: `eslint-tech-debt-bot`
5. Print the PR URL and stop.

## If there is nothing to do

If `eslint-suppressions.json` is empty, or you've exhausted reasonable candidates without completing one cleanly, exit without opening a PR.
