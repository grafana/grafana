# Grafana Explore internationalization (i18n) automation & contribution guide

> **Target Audience**: Grafana Core Developers, Open-Source Contributors, and Core Tooling  
> **Reference**: GitHub Issue [#73984](https://github.com/grafana/grafana/issues/73984) — _Explore: Internationalize UI strings_  
> **Target Directory**: `public/app/features/explore`  
> **Core Package**: `@grafana/i18n` (`packages/grafana-i18n`)

---

## Table of Contents

1. [Background & Purpose](#1-background--purpose)
2. [Architectural Invariants](#2-architectural-invariants)
   - [When to Use `<Trans>` vs `t()`](#when-to-use-trans-vs-t)
   - [Module Scope Safety (Critical Invariant)](#module-scope-safety-critical-invariant)
   - [Variable Interpolation](#variable-interpolation)
   - [Pluralization Standards](#pluralization-standards)
   - [Forbidden Direct Imports](#forbidden-direct-imports)
3. [Key Naming Convention (Strict 3-Segment Kebab-Case)](#3-key-naming-convention-strict-3-segment-kebab-case)
   - [Namespace Schema](#namespace-schema)
   - [Defect Prevention (The 4-Segment Trap)](#defect-prevention-the-4-segment-trap)
   - [Static Extractability Requirement](#static-extractability-requirement)
4. [Explore i18n Automation Helper (`scripts/explore-i18n-helper.js`)](#4-explore-i18n-automation-helper-scriptsexplore-i18n-helperjs)
   - [Tool Overview](#tool-overview)
   - [Command Reference & CLI Usage](#command-reference--cli-usage)
   - [Auditing with `--check`](#auditing-with---check)
   - [Safe Previews with `--dry-run`](#safe-previews-with---dry-run)
   - [Automated Fixes with `--fix`](#automated-fixes-with---fix)
   - [Health Dashboard with `--stats`](#health-dashboard-with---stats)
5. [Built-in ESLint Rule Integration](#5-built-in-eslint-rule-integration)
   - [`@grafana/i18n/no-untranslated-strings`](#grafanai18nno-untranslated-strings)
   - [Role of `translation-utils.cjs`](#role-of-translation-utilscjs)
   - [How `forceFix` Operates](#how-forcefix-operates)
   - [Tooling Synergy (Helper Tool vs ESLint)](#tooling-synergy-helper-tool-vs-eslint)
6. [Verification Pipeline](#6-verification-pipeline)
   - [Step-by-Step Pre-PR Checklist](#step-by-step-pre-pr-checklist)
   - [CLI Verification Runner (`scripts/verify-explore-i18n.js`)](#cli-verification-runner-scriptsverify-explore-i18njs)
   - [Jest & React Testing Library Suite](#jest--react-testing-library-suite)
   - [Linting and Typecheck Smoke](#linting-and-typecheck-smoke)
7. [Open-Source PR Policy & Crowdin Synchronization](#7-open-source-pr-policy--crowdin-synchronization)
   - [Crowdin Synchronization Architecture](#crowdin-synchronization-architecture)
   - [Prohibition Against Manual Edits to `grafana.json`](#prohibition-against-manual-edits-to-grafanajson)
   - [Extraction Workflow (`make i18n-extract`)](#extraction-workflow-make-i18n-extract)

---

## 1. Background & Purpose

Grafana is committed to providing a fully localized, globally accessible user experience. Explore (`public/app/features/explore`) is one of Grafana's most critical query, visualization, and observability features, containing complex workflows across metrics, logs, traces, and profiles.

Historically, numerous UI elements in Explore contained hardcoded English strings. **Issue #73984** tracks the complete internationalization of the Explore feature. To avoid regressions, ensure consistent translation keys, and maintain developer velocity across distributed open-source teams, Grafana has instituted strict architectural conventions and automated tooling.

This guide documents the engineering principles, standard workflows, and specialized CLI tools developed to internationalize Explore components safely, predictably, and efficiently.

---

## 2. Architectural Invariants

Grafana frontend uses the `@grafana/i18n` package (built on top of `i18next` and `react-i18next`). All internationalization in Explore must adhere to the following invariants.

### When to Use `<Trans>` vs `t()`

Grafana provides two distinct translation primitives:

| Primitive   | Type                  | Best For                     | Typical Scenarios                                                                                                                  |
| ----------- | --------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `<Trans />` | React Component       | JSX Children                 | Visible UI text, paragraph copy, rich text with nested HTML tags (`<strong>`, `<a>`, `<button>`), complex plural JSX layouts.      |
| `t()`       | Pure Function / Macro | Props, Attributes, Callbacks | JSX attributes (`title`, `aria-label`, `placeholder`, `tooltip`, `description`), dynamic expressions, menu labels, select options. |

#### Rule of Thumb

- If the text is **inside** JSX tags (`<div>...</div>`, `<span>...</span>`, `<Button>...</Button>`), use **`<Trans>`**.
- If the text is passed as a **prop/attribute** (`title="..."`, `placeholder="..."`) or generated in a function, use **`t()`**.

#### Example: `<Trans>` for JSX Children

```tsx
import { Trans } from '@grafana/i18n';

export const NoData = () => (
  <div className="no-data-wrapper">
    <Trans i18nKey="explore.no-data.message">No data</Trans>
  </div>
);
```

#### Example: `t()` for Props and Attributes

```tsx
import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

export const TimeSyncButton = ({ isSynced, onClick }: Props) => (
  <ToolbarButton
    icon="link"
    aria-label={
      isSynced
        ? t('explore.time-sync-button.aria-label-synced', 'Synced times')
        : t('explore.time-sync-button.aria-label-unsynced', 'Unsynced times')
    }
    onClick={onClick}
  />
);
```

---

### Module Scope Safety (Critical Invariant)

> ⚠️ **CRITICAL RULE**: You must **NEVER** invoke `t()` at root module scope (outside React components, hooks, or functions).

#### Why Root Scope `t()` Fails

`t()` is a runtime function evaluated when it is executed. If invoked at top-level module evaluation:

1. It executes before Grafana's i18n engine has loaded the active user locale or message catalog.
2. If the user changes language or the active tenant locale is dynamically switched, top-level evaluated strings will **never re-render**, remaining permanently frozen in English.
3. It breaks SSR and static bundle optimization.

#### Anti-Pattern (Root Module Scope Call)

```tsx
// ❌ FORBIDDEN: Evaluates during module load time!
import { t } from '@grafana/i18n';

const DROPDOWN_LABEL = t('explore.dropdown.label', 'Select option'); // VIOLATION!

export const MyComponent = () => <div>{DROPDOWN_LABEL}</div>;
```

#### Correct Pattern (Component Scope or Getter Function)

```tsx
// ✓ CORRECT: Evaluated inside React component render
import { t } from '@grafana/i18n';

export const MyComponent = () => {
  const dropdownLabel = t('explore.dropdown.label', 'Select option');
  return <div>{dropdownLabel}</div>;
};

// ✓ CORRECT: Getter function evaluated lazily when needed
export const getDropdownLabel = () => t('explore.dropdown.label', 'Select option');
```

The ESLint rule `@grafana/i18n/no-translation-top-level` and the CLI audit runner `node scripts/verify-explore-i18n.js` strictly fail CI if any root scope `t()` invocation is detected.

---

### Variable Interpolation

When UI text includes dynamic values (usernames, pane labels, elapsed times, counts), use mustache template variables `{{varName}}`.

#### Using `t()` with Interpolation

```tsx
import { t } from '@grafana/i18n';

const buttonText = t('explore.run-query.pane-action-label', '{{pane}}: {{action}}', {
  pane: paneLabel,
  action: actionText,
});
```

#### Using `<Trans>` with Interpolation

```tsx
import { Trans } from '@grafana/i18n';

export const ResultCount = ({ count, queryName }: Props) => (
  <Trans i18nKey="explore.query-results.count-summary" values={{ count, queryName }}>
    Showing {{ count }} results for query {{ queryName }}.
  </Trans>
);
```

> **Note**: Placeholder names in the string must exactly match the keys in the values object. TypeScript cannot validate template keys at compile-time.

---

### Pluralization Standards

Locales have different pluralization rules (some languages have 2 plural forms, others have 4 or 6). When translating quantities, you must pass `count` and provide both `defaultValue_one` and `defaultValue_other`.

#### Using `t()` for Plurals

```tsx
import { t } from '@grafana/i18n';

const logCountMessage = t('explore.logs.line-count', '{{count}} log lines', {
  count: totalLines,
  defaultValue_one: '{{count}} log line',
  defaultValue_other: '{{count}} log lines',
});
```

#### Using `<Trans>` for Plurals

```tsx
import { Trans } from '@grafana/i18n';

<Trans
  i18nKey="explore.logs.line-count"
  count={totalLines}
  tOptions={{
    defaultValue_one: '{{count}} log line',
    defaultValue_other: '{{count}} log lines',
  }}
>
  {{ count: totalLines }} log lines
</Trans>;
```

---

### Forbidden Direct Imports

> ⚠️ **RULE**: Always import `{ Trans, t }` from `@grafana/i18n`. Direct imports from `react-i18next` or `i18next` are strictly prohibited.

```tsx
// ❌ FORBIDDEN
import { useTranslation, Trans } from 'react-i18next';
import i18next from 'i18next';

// ✓ CORRECT
import { Trans, t } from '@grafana/i18n';
```

---

## 3. Key Naming Convention (Strict 3-Segment Kebab-Case)

Translation keys in Grafana must be easily traceable, collision-free, and statically extractable.

### Namespace Schema

Every Explore translation key must strictly follow a **3-segment kebab-case convention**:

$$\mathbf{explore}.\mathbf{\langle component\text{-}kebab\rangle}.\mathbf{\langle descriptor\text{-}kebab\rangle}$$

```text
Segment 1: explore              (The top-level feature namespace)
Segment 2: <component-kebab>    (The component or view identifier in lowercase kebab-case)
Segment 3: <descriptor-kebab>   (The concise, lowercase kebab-case descriptor of the string)
```

#### Approved Examples

- `explore.no-data.message`
- `explore.error-container.query-error`
- `explore.error-container.unknown-error`
- `explore.time-sync-button.tooltip-unsync-all-views`
- `explore.time-sync-button.tooltip-sync-all-views`
- `explore.explore-query-inspector.formatted-data-description`
- `explore.explore-query-inspector.close-icon-tooltip`
- `explore.run-query.switch-datasource-button`

---

### Defect Prevention (The 4-Segment Trap)

A common pitfall is adding sub-namespaces with dots, creating 4 or more segments:

```text
❌ DEFECT: explore.no-data-source-call-to-action.footer.learn-more  (4 segments!)
❌ DEFECT: explore.query-inspector.data-tab.label.data               (5 segments!)
```

#### The Flattening Rule

When describing a sub-component, nested tab, or child element, **flatten the path with hyphens into the descriptor segment (Segment 3)**:

```text
✓ CORRECT: explore.no-data-source-call-to-action.footer-learn-more   (3 segments)
✓ CORRECT: explore.query-inspector.data-tab-label-data               (3 segments)
```

#### Format Validation Regex

Every segment must independently satisfy:

```regex
^[a-z0-9]+(-[a-z0-9]+)*$
```

No uppercase letters, underscores, special characters, or consecutive hyphens are permitted.

---

### Static Extractability Requirement

The translation extractor (`i18next-cli`) runs static AST analysis without executing code. Therefore:

- The `i18nKey` and the first parameter to `t()` **must be static string literals**.
- Template string concatenation or dynamic expressions are strictly prohibited:

```tsx
// ❌ BROKEN: Cannot be statically extracted
const key = `explore.${component}.${name}`;
t(key, 'Fallback');

// ✓ CORRECT: Literal string key
t('explore.time-sync-button.tooltip-sync', 'Sync all views');
```

---

## 4. Explore i18n Automation Helper (`scripts/explore-i18n-helper.js`)

To accelerate internationalization across all 178+ TSX components in Explore, Grafana provides a dedicated, repeatable CLI automation tool: `scripts/explore-i18n-helper.js`.

### Tool Overview

The helper tool uses the TypeScript AST engine (`ts.createSourceFile`) to inspect source files, detect hardcoded English strings, apply AST transformations, and enforce 3-segment key naming conventions automatically.

```text
grafana/
└── scripts/
    └── explore-i18n-helper.js   <-- Explore i18n Automation Tool
```

### Command Reference & CLI Usage

```bash
node scripts/explore-i18n-helper.js [options] [path]
```

| Flag | Long Flag   | Parameter    | Description                                                                                  |
| ---- | ----------- | ------------ | -------------------------------------------------------------------------------------------- |
| `-c` | `--check`   | `[file/dir]` | Scans TSX files and lists untranslated strings. Exits `0` if clean, `1` if violations found. |
| `-d` | `--dry-run` | `[file/dir]` | Previews AST transformations without modifying files on disk.                                |
| `-f` | `--fix`     | `[file/dir]` | Automatically rewrites TSX files with `<Trans>` and `t()`, updating imports.                 |
| `-s` | `--stats`   | `[file/dir]` | Generates an exhaustive i18n audit dashboard across Explore components.                      |
| `-h` | `--help`    | —            | Displays the CLI help screen.                                                                |
| `-v` | `--verbose` | —            | Shows clean file statuses during check runs.                                                 |

---

### Auditing with `--check`

Run `--check` on individual files or entire directories to locate untranslated strings.

#### Example 1: Auditing an Already Translated Component

```bash
node scripts/explore-i18n-helper.js --check public/app/features/explore/NoData.tsx
```

**Output**:

```text
[CHECK] Scanning 1 TSX file(s) for untranslated strings...

------------------------------------------------------------
✓ All audited files are clean! No untranslated strings detected.
```

_(Process exits with code `0`)_

#### Example 2: Auditing a Candidate Component with Untranslated Strings

```bash
node scripts/explore-i18n-helper.js --check public/app/features/explore/TimeSyncButton.tsx
```

**Output**:

```text
[CHECK] Scanning 1 TSX file(s) for untranslated strings...

  ✗ public/app/features/explore/TimeSyncButton.tsx: 2 untranslated string(s)
    - Line 14:32 [ui-literal] "Unsync all views"
      Suggested Key: explore.time-sync-button.tooltip-unsync-all-views
    - Line 14:53 [ui-literal] "Sync all views to this time range"
      Suggested Key: explore.time-sync-button.tooltip-sync-all-views

------------------------------------------------------------
✗ Found 2 untranslated string(s) across 1 file(s).
  Run with --fix to apply transformations automatically, or --dry-run to preview.
```

_(Process exits with code `1`)_

---

### Safe Previews with `--dry-run`

Before modifying files, use `--dry-run` to preview exactly what transformations will be made:

```bash
node scripts/explore-i18n-helper.js --dry-run public/app/features/explore/TimeSyncButton.tsx
```

**Output**:

```text
[DRY-RUN] Processing 1 file(s)...

  Preview for public/app/features/explore/TimeSyncButton.tsx: 2 transformation(s)
    Line 14: "Sync all views to this time range" -> t('explore.time-sync-button.tooltip-sync-all-views', 'Sync all views to this time range')
    Line 14: "Unsync all views" -> t('explore.time-sync-button.tooltip-unsync-all-views', 'Unsync all views')

------------------------------------------------------------
[DRY-RUN] Previewed 2 transformation(s) across 1 file(s).
```

No files are modified on disk.

---

### Automated Fixes with `--fix`

Running with `--fix` performs AST-accurate text replacement:

1. Wraps raw JSX text in `<Trans i18nKey="explore.<comp>.<desc>">text</Trans>`.
2. Replaces JSX attributes with `propName={t('explore.<comp>.<desc>', 'text')}`.
3. Automatically inserts or updates `import { Trans, t } from '@grafana/i18n';` at the top of the file.
4. Uses descending-position text splicing to ensure zero character offset drift.

```bash
node scripts/explore-i18n-helper.js --fix public/app/features/explore/TimeSyncButton.tsx
```

---

### Health Dashboard with `--stats`

Run `--stats` to get a comprehensive audit across all 178 Explore components:

```bash
node scripts/explore-i18n-helper.js --stats
```

**Output**:

```text
============================================================
   Grafana Explore i18n Automation & Audit Statistics
============================================================

[Summary Metrics]
  Total Explore TSX Components:      178
  Fully Internationalized Files:     88 (49.4%)
  Partially Internationalized Files: 3 (1.7%)
  Untranslated Component Files:      2 (1.1%)
  Pure Logic / Wrapper Files:        85 (47.8%)

  Total Translated Keys:             468
  Total Untranslated Strings:        10
  Overall Translation Health Score:  97.9%

[Milestone 1 Components: Proof-of-Concept]
  ✓ NoData.tsx                   - 1 key(s), 0 untranslated [fully-translated]
  ✓ ErrorContainer.tsx           - 2 key(s), 0 untranslated [fully-translated]
  ✓ ResponseErrorContainer.tsx   - 0 key(s), 0 untranslated [pure-logic]
  ✓ NoDataSourceCallToAction.tsx - 4 key(s), 0 untranslated [fully-translated]

[Milestone 3 Components: Secondary Batch Candidates]
  ⚠ TimeSyncButton.tsx           - 2 key(s), 2 untranslated [partially-translated]
  ✓ ExploreRunQueryButton.tsx    - 6 key(s), 0 untranslated [fully-translated]
  ⚠ ExploreQueryInspector.tsx    - 5 key(s), 2 untranslated [partially-translated]
  ✓ ExploreGraphLabel.tsx        - 0 key(s), 0 untranslated [pure-logic]

============================================================
```

---

## 5. Built-in ESLint Rule Integration

In addition to the standalone helper CLI, Grafana enforces i18n standards through custom ESLint rules built into the repository.

### `@grafana/i18n/no-untranslated-strings`

Located at `packages/grafana-i18n/src/eslint/no-untranslated-strings/`, this rule checks for:

- Raw text inside JSX elements (suggesting `<Trans>`).
- Untranslated string literals in common UI props (`title`, `aria-label`, `placeholder`, `tooltip`, `description`, `confirmText`).
- Untranslated object properties passed to UI components.

### Role of `translation-utils.cjs`

The core AST traversal and key generation logic for the ESLint rule is defined in `translation-utils.cjs`. It contains:

- `canBeFixed(node, context)`: Evaluates if a node is safely auto-fixable (e.g. inside a function, length $< 10$ words, alphanumeric).
- `getI18nKey(node, context)`: Generates candidate translation keys based on file paths and component names.
- `getImportsFixer(node, fixer, importName, context)`: Manages inserting `@grafana/i18n` imports.

### How `forceFix` Operates

In `eslint.config.js`, the rule accepts an option `forceFix`:

```js
{
  '@grafana/i18n/no-untranslated-strings': [
    'error',
    {
      forceFix: ['public/app/features/explore'],
      calleesToIgnore: ['^css$', 'use[A-Z].*'],
      basePaths: ['public/app/features'],
    }
  ]
}
```

When a file path matches an entry in `forceFix`, running `yarn eslint --fix` will automatically apply ESLint's auto-fixer rather than just reporting the error.

### Tooling Synergy (Helper Tool vs ESLint)

While ESLint's built-in rule provides continuous CI enforcement, the specialized `explore-i18n-helper.js` script provides critical advantages for contributors:

1. **Strict 3-Segment Key Guarantees**: ESLint's `translation-utils.cjs` occasionally generates 4-segment or 5-segment keys when traversing deeply nested elements. `explore-i18n-helper.js` strictly enforces exactly 3 segments.
2. **Context-Aware UI Detection**: The helper tool detects UI strings in ternary expressions and helper methods (like `syncTimesTooltip` in `TimeSyncButton.tsx`) that ESLint cannot safely infer.
3. **Safe Dry-Run & Full Audit Metrics**: The helper provides rich metrics, component classification, and diff previews without requiring changes to repository-wide ESLint configurations.

---

## 6. Verification Pipeline

Before opening a Pull Request for any Explore i18n change, run the complete 5-stage verification pipeline.

### Step-by-Step Pre-PR Checklist

```bash
# 1. Check your modified component with the helper tool
node scripts/explore-i18n-helper.js --check public/app/features/explore/<YourComponent>.tsx

# 2. Run the repository-level i18n verification scanner
node scripts/verify-explore-i18n.js

# 3. Lint the affected files
yarn eslint public/app/features/explore/<YourComponent>.tsx scripts/explore-i18n-helper.js

# 4. Run frontend smoke typecheck
yarn typecheck:smoke

# 5. Run the dedicated Jest i18n test suite
yarn jest public/app/features/explore/spec/explore-i18n.test.tsx
```

---

### CLI Verification Runner (`scripts/verify-explore-i18n.js`)

Grafana provides a fast diagnostic scanner that validates repository invariants:

1. Zero forbidden direct imports (`react-i18next`, `i18next`).
2. Zero root module scope calls to `t()`.
3. Format validity of all `explore.*` keys.
4. Static extractability by `i18next-cli`.

**Execution**:

```bash
node scripts/verify-explore-i18n.js
```

---

### Jest & React Testing Library Suite

The test suite in `public/app/features/explore/spec/explore-i18n.test.tsx` validates:

- Fallback English text rendering in tests and headless environments.
- Interpolation of variables in strings.
- Plural default fallbacks.
- Live DOM mounting of translated components.

**Execution**:

```bash
yarn jest public/app/features/explore/spec/explore-i18n.test.tsx
```

**Expected Output**:

```text
PASS public/app/features/explore/spec/explore-i18n.test.tsx
  Explore i18n Invariants & Fallback Rendering
    ✓ renders fallback English text when calling t() (3 ms)
    ✓ renders interpolated variables correctly with t() (1 ms)
    ✓ handles pluralization fallback defaults (2 ms)
    ...
Test Suites: 1 passed, 1 total
Tests:       30 passed, 30 total
```

---

### Linting and Typecheck Smoke

Verify that no TypeScript or ESLint errors were introduced:

```bash
yarn eslint public/app/features/explore/<YourComponent>.tsx
yarn typecheck:smoke
```

---

## 7. Open-Source PR Policy & Crowdin Synchronization

### Crowdin Synchronization Architecture

Grafana's internationalization pipeline uses an automated translation management platform:

1. Developers mark up phrases in TypeScript/TSX using `@grafana/i18n`.
2. Running `make i18n-extract` (or `yarn i18n-extract`) extracts these strings into the English message catalog: `public/locales/en-US/grafana.json`.
3. An automated GitHub Action pushes the updated `en-US` catalog to Crowdin.
4. Crowdin's community translators and professional proofreaders translate phrases into target languages.
5. Automated pull requests periodically download localized catalogs (`public/locales/{locale}/grafana.json`) back into the repository.

### Prohibition Against Manual Edits to `grafana.json`

> 🚫 **STRICT REPOSITORY POLICY**:  
> **NEVER manually edit localized JSON files** (e.g. `public/locales/de-DE/grafana.json`, `public/locales/es-ES/grafana.json`, etc.).
>
> Any Pull Request that manually modifies non-English `grafana.json` files **will be rejected immediately**. All localized translations are managed exclusively via Crowdin.

### Extraction Workflow (`make i18n-extract`)

When you add or update translatable phrases in source components:

1. Only edit the source TSX/TS files with `<Trans>` and `t()`.
2. Extract the updated strings into the English catalog:
   ```bash
   yarn packages:i18n-extract
   ```
3. Commit the source file changes.

---

## Summary Reference Table

| Check                | Command                                                            | Success Criteria                                                            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **CLI Help**         | `node scripts/explore-i18n-helper.js --help`                       | Exit code 0, displays usage instructions                                    |
| **Component Check**  | `node scripts/explore-i18n-helper.js --check <file>`               | Exit code 0 for clean components; exit code 1 if untranslated strings found |
| **Audit Dashboard**  | `node scripts/explore-i18n-helper.js --stats`                      | Exit code 0, prints summary metrics & milestone statuses                    |
| **Repository Audit** | `node scripts/verify-explore-i18n.js`                              | 0 forbidden imports, 0 top-level calls, 0 format defects                    |
| **Linter**           | `yarn eslint <files>`                                              | 0 errors, 0 warnings                                                        |
| **Jest Suite**       | `yarn jest public/app/features/explore/spec/explore-i18n.test.tsx` | All tests pass (30/30)                                                      |
| **Smoke Typecheck**  | `yarn typecheck:smoke`                                             | Exit code 0                                                                 |
