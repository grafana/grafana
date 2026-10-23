# Row Shell, Description Line, and Interval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend GMA rule list rows with a description line (last error / summary annotation) and an interval indicator in the right column, using data already available from search.

**Architecture:** Add `description` and `right` props to `RuleListItem`. Add two new shared components (`RuleDescription`, `RuleInterval`). Extend both search queries to request `annotations` and `interval` fields. Extend both hit schemas (Zod) to parse them. Wire into `AlertRuleRow` and `RecordingRuleRow`. TDD throughout.

**Tech Stack:** React, TypeScript, Zod, Grafana UI (`Text`, `Icon`, `Tooltip`, `Stack`), Jest + React Testing Library

---

All new shared files: `public/app/features/alerting/unified/gma-rule-list/rule-row/`
All modified files under: `public/app/features/alerting/unified/gma-rule-list/`

**Key existing types and paths:**

- `RuleListItem`: `rule-row/RuleListItem.tsx`
- `AlertRuleSearchHit` + `alertRuleSearchHitSchema`: `alert-rules/alertRuleSearchHit.ts`
- `RecordingRuleSearchHit` + `recordingRuleSearchHitSchema`: `recording-rules/recordingRuleSearchHit.ts`
- `buildAlertRuleSearchQuery`: `alert-rules/alertRuleSearchQuery.ts`
- `buildRecordingRuleSearchQuery`: `recording-rules/recordingRuleSearchQuery.ts`
- `AlertRuleRow`: `alert-rules/AlertRuleRow.tsx`
- `RecordingRuleRow`: `recording-rules/RecordingRuleRow.tsx`

---

### Task 1: Extend RuleListItem with description and right slots

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleListItem.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleListItem.test.tsx`

- [ ] **Step 1: Add failing tests for the new slots**

Replace the entire contents of `RuleListItem.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { RuleListItem } from './RuleListItem';

describe('RuleListItem', () => {
  it('renders the title and only the truthy meta entries, in order', () => {
    render(
      <ul>
        <RuleListItem
          title="My rule"
          meta={[<span key="a">first</span>, null, false, <span key="b">second</span>, <span key="c">third</span>]}
        />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent(/^My rule/);
    expect(screen.getAllByTestId('rule-meta-item').map((item) => item.textContent)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('renders description between title and meta when provided', () => {
    render(
      <ul>
        <RuleListItem
          title="My rule"
          description={<span>Something went wrong</span>}
          meta={[<span key="a">meta item</span>]}
        />
      </ul>
    );

    const listitem = screen.getByRole('listitem');
    expect(listitem).toHaveTextContent('My rule');
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('meta item')).toBeInTheDocument();
  });

  it('renders nothing for description when absent', () => {
    render(
      <ul>
        <RuleListItem title="My rule" />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent('My rule');
  });

  it('renders the right slot when provided', () => {
    render(
      <ul>
        <RuleListItem title="My rule" right={<span>1m</span>} />
      </ul>
    );

    expect(screen.getByText('1m')).toBeInTheDocument();
  });

  it('renders nothing for right when absent', () => {
    render(
      <ul>
        <RuleListItem title="My rule" />
      </ul>
    );

    expect(screen.getByRole('listitem')).not.toHaveTextContent('1m');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleListItem.test.tsx
```

Expected: 2 new tests FAIL (description and right props don't exist yet)

- [ ] **Step 3: Implement the changes**

Replace the entire contents of `RuleListItem.tsx`:

```tsx
import { css } from '@emotion/css';
import { type AriaAttributes, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';

interface RuleListItemProps extends AriaAttributes {
  icon?: ReactNode;
  title: ReactNode;
  /** Renders between the title and the meta row. Absent means nothing is shown. */
  description?: ReactNode;
  /** Right column; never wraps. Used for interval and actions. */
  right?: ReactNode;
  /** Falsy entries are dropped. */
  meta?: ReactNode[];
}

export function RuleListItem({ icon, title, description, right, meta = [], ...ariaAttributes }: RuleListItemProps) {
  const styles = useStyles2(getStyles);
  const metaItems = meta.filter(Boolean);

  return (
    <li className={styles.container} {...ariaAttributes}>
      <Stack direction="row" alignItems="start" gap={1} wrap={false}>
        {icon && <span className={styles.icon}>{icon}</span>}

        <Stack direction="column" gap={0.5} flex="1" minWidth={0}>
          <div className={styles.overflow}>{title}</div>

          {description}

          {metaItems.length > 0 && (
            // Whole items wrap; each line's leading separator falls into the clipped margin.
            <div className={styles.metaClip}>
              <Stack direction="row" gap={1} alignItems="center" wrap>
                {metaItems.map((item, index) => (
                  <div key={index} className={styles.metaItem} data-testid="rule-meta-item">
                    {item}
                  </div>
                ))}
              </Stack>
            </div>
          )}
        </Stack>

        {right && (
          <Stack alignItems="center" gap={1} wrap={false}>
            {right}
          </Stack>
        )}
      </Stack>
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    listStyle: 'none',
    padding: theme.spacing(1),

    // Not action.hover: it drops secondary text below 4.5:1 contrast in the dark theme.
    '&:hover': {
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    },
  }),
  // Aligns the icon with the title text.
  icon: css({
    marginTop: theme.spacing(0.5),
  }),
  metaClip: css({
    overflow: 'hidden',
    '& > *': { marginLeft: `calc(-1 * (${theme.spacing(1)} + 1px))` },
  }),
  metaItem: css({
    borderLeft: `1px solid ${theme.colors.border.strong}`,
    paddingLeft: theme.spacing(1),
  }),
  overflow: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleListItem.test.tsx
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/rule-row/RuleListItem.tsx \
        public/app/features/alerting/unified/gma-rule-list/rule-row/RuleListItem.test.tsx
git commit -m "feat(alerting): add description and right slots to RuleListItem"
```

---

### Task 2: RuleDescription component

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDescription.tsx`
- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDescription.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `RuleDescription.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { RuleDescription } from './RuleDescription';

describe('RuleDescription', () => {
  it('shows the last error in error colour when present', () => {
    render(<RuleDescription lastError="remote write failed" />);

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
  });

  it('shows the summary in secondary colour when there is no error', () => {
    render(<RuleDescription summary="CPU usage is high" />);

    expect(screen.getByText('CPU usage is high')).toBeInTheDocument();
  });

  it('shows the error over the summary when both are present', () => {
    render(<RuleDescription lastError="remote write failed" summary="CPU usage is high" />);

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
    expect(screen.queryByText('CPU usage is high')).not.toBeInTheDocument();
  });

  it('renders nothing when neither error nor summary is present', () => {
    const { container } = render(<RuleDescription />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows a tooltip with the full error text', async () => {
    render(<RuleDescription lastError="remote write failed: connection refused" />);

    expect(await screen.findByLabelText('remote write failed: connection refused')).toBeInTheDocument();
  });

  it('shows a tooltip with the full summary text', async () => {
    render(<RuleDescription summary="Alert fires when CPU exceeds threshold" />);

    expect(await screen.findByLabelText('Alert fires when CPU exceeds threshold')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDescription.test.tsx
```

Expected: FAIL — `Cannot find module './RuleDescription'`

- [ ] **Step 3: Implement the component**

Create `RuleDescription.tsx`:

```tsx
import { Text, Tooltip } from '@grafana/ui';

interface RuleDescriptionProps {
  lastError?: string;
  /** Alert rules only; omit for recording rules. */
  summary?: string;
}

/** One-line description below the title: error (red) if present, else summary (secondary), else nothing. */
export function RuleDescription({ lastError, summary }: RuleDescriptionProps) {
  if (lastError) {
    return (
      <Tooltip content={lastError} placement="top">
        <Text variant="bodySmall" color="error" weight="light" truncate element="p" aria-label={lastError}>
          {lastError}
        </Text>
      </Tooltip>
    );
  }
  if (summary) {
    return (
      <Tooltip content={summary} placement="top">
        <Text variant="bodySmall" color="secondary" truncate element="p" aria-label={summary}>
          {summary}
        </Text>
      </Tooltip>
    );
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDescription.test.tsx
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDescription.tsx \
        public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDescription.test.tsx
git commit -m "feat(alerting): add RuleDescription component"
```

---

### Task 3: RuleInterval component

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInterval.tsx`
- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInterval.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `RuleInterval.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { RuleInterval } from './RuleInterval';

describe('RuleInterval', () => {
  it('renders the interval string with a clock icon', () => {
    render(<RuleInterval interval="5m" />);

    expect(screen.getByText('5m')).toBeInTheDocument();
  });

  it('has an accessible name that describes the evaluation cadence', () => {
    render(<RuleInterval interval="10m" />);

    expect(screen.getByRole('img', { name: 'Evaluated every 10m' })).toBeInTheDocument();
  });

  it('has a tooltip that describes the evaluation cadence', async () => {
    render(<RuleInterval interval="1h" />);

    expect(await screen.findByLabelText('Evaluated every 1h')).toBeInTheDocument();
  });

  it('renders nothing when interval is absent', () => {
    const { container } = render(<RuleInterval />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInterval.test.tsx
```

Expected: FAIL — `Cannot find module './RuleInterval'`

- [ ] **Step 3: Implement the component**

Create `RuleInterval.tsx`:

```tsx
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip } from '@grafana/ui';

interface RuleIntervalProps {
  interval?: string;
}

/** Evaluation interval indicator for the row's right column. */
export function RuleInterval({ interval }: RuleIntervalProps) {
  if (!interval) {
    return null;
  }

  const label = t('alerting.gma-rule-list.interval', 'Evaluated every {{interval}}', { interval });

  return (
    <Tooltip content={label} placement="top">
      <Stack direction="row" alignItems="center" gap={0.5} role="img" aria-label={label}>
        <Icon name="clock-nine" size="xs" />
        <Text variant="bodySmall" color="secondary">
          {interval}
        </Text>
      </Stack>
    </Tooltip>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInterval.test.tsx
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInterval.tsx \
        public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInterval.test.tsx
git commit -m "feat(alerting): add RuleInterval component"
```

---

### Task 4: Alert rule search query — add annotations and interval fields

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.ts`
- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.test.ts`

- [ ] **Step 1: Update the test to expect the new fields**

Replace the entire `alertRuleSearchQuery.test.ts`:

```ts
import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

describe('buildAlertRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows', () => {
    expect(buildAlertRuleSearchQuery()).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      sort: [{ field: 'title', direction: 'asc' }],
      fields: ['title', 'folder', 'paused', 'state', 'health', 'lastError', 'annotations', 'interval'],
      limit: 40,
    });
  });

  it('passes the continuation token through', () => {
    expect(buildAlertRuleSearchQuery('opaque-token').continue).toBe('opaque-token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.test.ts
```

Expected: FAIL — fields array does not match

- [ ] **Step 3: Update the query builder**

Replace the `ALERT_RULE_FIELDS` constant in `alertRuleSearchQuery.ts`:

```ts
// `state`, `health`, and `lastError` are status fields populated by `alerting.ruleStatusSync`.
// `annotations` returns as a JSON-encoded string; `interval` is the evaluation cadence.
const ALERT_RULE_FIELDS = ['title', 'folder', 'paused', 'state', 'health', 'lastError', 'annotations', 'interval'];
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.test.ts
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.ts \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.test.ts
git commit -m "feat(alerting): request annotations, lastError and interval in alert rule search"
```

---

### Task 5: Alert rule search hit — add lastError, summary, interval

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.ts`
- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.test.ts`

- [ ] **Step 1: Update the test to cover new fields**

Replace the entire `alertRuleSearchHit.test.ts`:

```ts
import { alertRuleSearchHitSchema } from './alertRuleSearchHit';

function toHit(fields?: unknown) {
  return alertRuleSearchHitSchema.parse({
    resource: { group: 'rules.alerting.grafana.app', kind: 'AlertRule', resource: 'alertrules', name: 'rule-1' },
    fields,
  });
}

describe('alertRuleSearchHitSchema', () => {
  it('reads the row fields from the search hit', () => {
    const hit = toHit({ title: 'CPU high', folder: 'folder-1', paused: true, state: 'Firing', health: 'OK' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'CPU high',
      folderUid: 'folder-1',
      paused: true,
      state: 'Firing',
      health: 'OK',
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true', state: null });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      state: undefined,
      health: undefined,
    });
  });

  it.each([
    { name: 'no fields', fields: undefined },
    { name: 'fields that are not an object', fields: 'title=CPU high' },
  ])('falls back to the rule UID alone when the search returned $name', ({ fields }) => {
    expect(toHit(fields)).toEqual({ uid: 'rule-1', title: 'rule-1' });
  });

  it.each([
    { name: 'another case', state: 'FIRING', health: 'ok' },
    { name: 'an unknown value', state: 'Mystery', health: 'Degraded' },
    { name: 'the Recording rule health', state: 'Firing', health: 'Recording' },
  ])('leaves state or health unset for $name', ({ state, health }) => {
    const hit = toHit({ state, health });

    expect(hit.health).toBeUndefined();
    expect(hit.state).toBe(state === 'Firing' ? 'Firing' : undefined);
  });

  it('reads lastError from the search hit', () => {
    const hit = toHit({ lastError: 'remote write failed' });

    expect(hit.lastError).toBe('remote write failed');
  });

  it('leaves lastError unset when absent or not a string', () => {
    expect(toHit({}).lastError).toBeUndefined();
    expect(toHit({ lastError: 42 }).lastError).toBeUndefined();
  });

  it('reads the summary annotation from the JSON-encoded annotations field', () => {
    const annotations = JSON.stringify({ summary: 'CPU is high', runbook_url: 'https://example.com' });
    const hit = toHit({ annotations });

    expect(hit.summary).toBe('CPU is high');
  });

  it('leaves summary unset when annotations has no summary key', () => {
    const hit = toHit({ annotations: JSON.stringify({ runbook_url: 'https://example.com' }) });

    expect(hit.summary).toBeUndefined();
  });

  it('leaves summary unset when annotations is malformed JSON', () => {
    expect(toHit({ annotations: 'not-json' }).summary).toBeUndefined();
    expect(toHit({ annotations: 42 }).summary).toBeUndefined();
  });

  it('reads interval from the search hit', () => {
    const hit = toHit({ interval: '5m' });

    expect(hit.interval).toBe('5m');
  });

  it('leaves interval unset when absent or not a string', () => {
    expect(toHit({}).interval).toBeUndefined();
    expect(toHit({ interval: 60 }).interval).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.test.ts
```

Expected: FAIL — new tests fail, `lastError`, `summary`, `interval` not on hit

- [ ] **Step 3: Implement the changes**

Replace the entire `alertRuleSearchHit.ts`:

```ts
import * as z from 'zod';

import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

export interface AlertRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** Absent until `alerting.ruleStatusSync` populates it; absence reads as Unavailable. */
  state?: AlertRuleAlertRuleState;
  health?: AlertRuleAlertRuleHealth;
  /** Absent until `alerting.ruleStatusSync` populates it. */
  lastError?: string;
  /** From the rule's `summary` annotation; absent when the annotation is missing. */
  summary?: string;
  /** Evaluation interval, e.g. "1m". */
  interval?: string;
}

// Keyed by the generated unions, so a value the API adds or drops fails the type check here.
const ALERT_RULE_STATES = {
  Inactive: 'Inactive',
  Healthy: 'Healthy',
  Firing: 'Firing',
  Pending: 'Pending',
  Recovering: 'Recovering',
} satisfies Record<AlertRuleAlertRuleState, AlertRuleAlertRuleState>;

const ALERT_RULE_HEALTHS = {
  Unknown: 'Unknown',
  OK: 'OK',
  Paused: 'Paused',
  Error: 'Error',
  NoData: 'NoData',
} satisfies Record<AlertRuleAlertRuleHealth, AlertRuleAlertRuleHealth>;

// annotations comes back as a JSON-encoded string; parse it safely.
function tryParseAnnotations(s: string): Record<string, string> | undefined {
  try {
    const parsed: unknown = JSON.parse(s);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Search fields are untyped in the API. A field that is missing or fails its check reads as absent
// instead of failing the whole hit.
const alertRuleSearchFieldsSchema = z.object({
  title: z.string().optional().catch(undefined),
  folder: z.string().optional().catch(undefined),
  paused: z.boolean().optional().catch(undefined),
  state: z.enum(ALERT_RULE_STATES).optional().catch(undefined),
  health: z.enum(ALERT_RULE_HEALTHS).optional().catch(undefined),
  lastError: z.string().optional().catch(undefined),
  annotations: z.string().transform(tryParseAnnotations).optional().catch(undefined),
  interval: z.string().optional().catch(undefined),
});

/** Parses one search item straight into the row's shape. */
export const alertRuleSearchHitSchema = z
  .object({
    resource: z.object({ name: z.string() }),
    fields: alertRuleSearchFieldsSchema.catch({}),
  })
  .transform(
    ({ resource, fields }): AlertRuleSearchHit => ({
      uid: resource.name,
      title: fields.title ?? resource.name,
      folderUid: fields.folder,
      paused: fields.paused,
      state: fields.state,
      health: fields.health,
      lastError: fields.lastError,
      summary: fields.annotations?.['summary'],
      interval: fields.interval,
    })
  );
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.test.ts
```

Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.ts \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.test.ts
git commit -m "feat(alerting): add lastError, summary and interval to AlertRuleSearchHit"
```

---

### Task 6: Recording rule search query — add annotations and interval fields

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.ts`
- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts`

- [ ] **Step 1: Update the test**

Replace the entire `recordingRuleSearchQuery.test.ts`:

```ts
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

describe('buildRecordingRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows, without a state field', () => {
    expect(buildRecordingRuleSearchQuery()).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      sort: [{ field: 'title', direction: 'asc' }],
      fields: ['title', 'folder', 'paused', 'health', 'lastError', 'annotations', 'interval'],
      limit: 40,
    });
  });

  it('passes the continuation token through', () => {
    expect(buildRecordingRuleSearchQuery('opaque-token').continue).toBe('opaque-token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts
```

Expected: FAIL — fields array does not match

- [ ] **Step 3: Update the query builder**

Replace the `RECORDING_RULE_FIELDS` constant in `recordingRuleSearchQuery.ts`:

```ts
// `health` and `lastError` are status fields populated by `alerting.ruleStatusSync`.
// `annotations` returns as a JSON-encoded string; `interval` is the evaluation cadence.
const RECORDING_RULE_FIELDS = ['title', 'folder', 'paused', 'health', 'lastError', 'annotations', 'interval'];
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.ts \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts
git commit -m "feat(alerting): request annotations, lastError and interval in recording rule search"
```

---

### Task 7: Recording rule search hit — add lastError and interval

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.ts`
- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts`

- [ ] **Step 1: Update the test**

Replace the entire `recordingRuleSearchHit.test.ts`:

```ts
import { recordingRuleSearchHitSchema } from './recordingRuleSearchHit';

function toHit(fields?: unknown) {
  return recordingRuleSearchHitSchema.parse({
    resource: {
      group: 'rules.alerting.grafana.app',
      kind: 'RecordingRule',
      resource: 'recordingrules',
      name: 'rule-1',
    },
    fields,
  });
}

describe('recordingRuleSearchHitSchema', () => {
  it('reads the row fields from the search hit', () => {
    const hit = toHit({ title: 'cpu:usage:rate5m', folder: 'folder-1', paused: true, health: 'Recording' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'cpu:usage:rate5m',
      folderUid: 'folder-1',
      paused: true,
      health: 'Recording',
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      health: undefined,
    });
  });

  it.each([
    { name: 'no fields', fields: undefined },
    { name: 'fields that are not an object', fields: 'title=cpu:usage:rate5m' },
  ])('falls back to the rule UID alone when the search returned $name', ({ fields }) => {
    expect(toHit(fields)).toEqual({ uid: 'rule-1', title: 'rule-1' });
  });

  it.each([
    { name: 'wrong case', health: 'recording' },
    { name: 'an unknown value', health: 'Degraded' },
    { name: 'an Alert rule health value', health: 'OK' },
  ])('leaves health unset for $name', ({ health }) => {
    expect(toHit({ health }).health).toBeUndefined();
  });

  it('reads lastError from the search hit', () => {
    const hit = toHit({ lastError: 'remote write failed' });

    expect(hit.lastError).toBe('remote write failed');
  });

  it('leaves lastError unset when absent or not a string', () => {
    expect(toHit({}).lastError).toBeUndefined();
    expect(toHit({ lastError: 42 }).lastError).toBeUndefined();
  });

  it('does not expose a summary field even when annotations are present', () => {
    const annotations = JSON.stringify({ summary: 'some summary' });
    const hit = toHit({ annotations });

    expect(hit).not.toHaveProperty('summary');
  });

  it('reads interval from the search hit', () => {
    const hit = toHit({ interval: '1m' });

    expect(hit.interval).toBe('1m');
  });

  it('leaves interval unset when absent or not a string', () => {
    expect(toHit({}).interval).toBeUndefined();
    expect(toHit({ interval: 60 }).interval).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts
```

Expected: FAIL — `lastError` and `interval` not on hit

- [ ] **Step 3: Implement the changes**

Replace the entire `recordingRuleSearchHit.ts`:

```ts
import * as z from 'zod';

import { type RecordingRuleRecordingRuleHealth } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

export interface RecordingRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** Absent until `alerting.ruleStatusSync` populates it; absence reads as Unavailable. */
  health?: RecordingRuleRecordingRuleHealth;
  /** Absent until `alerting.ruleStatusSync` populates it. */
  lastError?: string;
  /** Evaluation interval, e.g. "1m". */
  interval?: string;
}

// Keyed by the generated union, so a value the API adds or drops fails the type check here.
const RECORDING_RULE_HEALTHS = {
  Unknown: 'Unknown',
  Recording: 'Recording',
  Paused: 'Paused',
  Error: 'Error',
  NoData: 'NoData',
} satisfies Record<RecordingRuleRecordingRuleHealth, RecordingRuleRecordingRuleHealth>;

// Search fields are untyped in the API. A field that is missing or fails its check reads as absent
// instead of failing the whole hit.
const recordingRuleSearchFieldsSchema = z.object({
  title: z.string().optional().catch(undefined),
  folder: z.string().optional().catch(undefined),
  paused: z.boolean().optional().catch(undefined),
  health: z.enum(RECORDING_RULE_HEALTHS).optional().catch(undefined),
  lastError: z.string().optional().catch(undefined),
  interval: z.string().optional().catch(undefined),
});

/** Parses one search item straight into the row's shape. */
export const recordingRuleSearchHitSchema = z
  .object({
    resource: z.object({ name: z.string() }),
    fields: recordingRuleSearchFieldsSchema.catch({}),
  })
  .transform(
    ({ resource, fields }): RecordingRuleSearchHit => ({
      uid: resource.name,
      title: fields.title ?? resource.name,
      folderUid: fields.folder,
      paused: fields.paused,
      health: fields.health,
      lastError: fields.lastError,
      interval: fields.interval,
    })
  );
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts
```

Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.ts \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts
git commit -m "feat(alerting): add lastError and interval to RecordingRuleSearchHit"
```

---

### Task 8: Wire description and interval into AlertRuleRow

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx`

- [ ] **Step 1: Add failing tests**

Replace the entire `AlertRuleRow.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', folderUid: 'folder-1', ...overrides };
}

function renderRow(props: Parameters<typeof AlertRuleRow>[0]) {
  return render(
    <ul>
      <AlertRuleRow {...props} />
    </ul>
  );
}

describe('AlertRuleRow', () => {
  it('links the title to the rule view and labels the list item with it', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByRole('link', { name: 'CPU high' })).toHaveAttribute('href', '/alerting/grafana/rule-1/view');
    expect(screen.getByRole('listitem', { name: 'CPU high' })).toBeInTheDocument();
  });

  it('shows the status icon of the search hit', () => {
    renderRow({ searchHit: baseHit({ state: 'Firing', health: 'OK' }) });

    expect(screen.getByLabelText('Firing')).toBeInTheDocument();
  });

  it('reads Status unavailable, never healthy, when the hit carries no status', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });

  it.each([
    { name: 'is known', folderPath: ['Platform', 'Team Alerts'], shown: true },
    { name: 'is still loading', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    renderRow({ searchHit: baseHit(), folderPath });

    expect(screen.getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts') !== null).toBe(shown);
  });

  it('shows the last error when the hit has one', () => {
    renderRow({ searchHit: baseHit({ lastError: 'remote write failed' }) });

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
  });

  it('shows the summary annotation when there is no error', () => {
    renderRow({ searchHit: baseHit({ summary: 'CPU usage is high' }) });

    expect(screen.getByText('CPU usage is high')).toBeInTheDocument();
  });

  it('shows no description when neither error nor summary is present', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText('remote write failed')).not.toBeInTheDocument();
    expect(screen.queryByText('CPU usage is high')).not.toBeInTheDocument();
  });

  it('shows the evaluation interval', () => {
    renderRow({ searchHit: baseHit({ interval: '5m' }) });

    expect(screen.getByRole('img', { name: 'Evaluated every 5m' })).toBeInTheDocument();
  });

  it('shows no interval indicator when interval is absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByRole('img', { name: /Evaluated every/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
```

Expected: 5 new tests FAIL

- [ ] **Step 3: Update AlertRuleRow**

Replace the entire `AlertRuleRow.tsx`:

```tsx
import { useId } from 'react';

import { TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleInterval } from '../rule-row/RuleInterval';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleRowProps {
  searchHit: AlertRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
}

/** Presentation-only; missing state/health renders "unavailable", never healthy. */
export function AlertRuleRow({ searchHit, folderPath }: AlertRuleRowProps) {
  const titleId = useId();

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="alert" state={searchHit.state} health={searchHit.health} paused={searchHit.paused} />}
      title={
        <TextLink id={titleId} href={grafanaRulesNav.viewLink(searchHit.uid)} color="primary" inline={false}>
          {searchHit.title}
        </TextLink>
      }
      description={<RuleDescription lastError={searchHit.lastError} summary={searchHit.summary} />}
      right={<RuleInterval interval={searchHit.interval} />}
      meta={[folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />]}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
```

Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
git commit -m "feat(alerting): add description and interval to AlertRuleRow"
```

---

### Task 9: Wire description and interval into RecordingRuleRow

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx`

- [ ] **Step 1: Add failing tests**

Replace the entire `RecordingRuleRow.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

function baseHit(overrides: Partial<RecordingRuleSearchHit> = {}): RecordingRuleSearchHit {
  return { uid: 'rule-1', title: 'cpu:usage:rate5m', folderUid: 'folder-1', ...overrides };
}

function renderRow(props: Parameters<typeof RecordingRuleRow>[0]) {
  return render(
    <ul>
      <RecordingRuleRow {...props} />
    </ul>,
    { historyOptions: { initialEntries: ['/alerting/rules/recording?search=cpu'] } }
  );
}

describe('RecordingRuleRow', () => {
  it('links the title to the rule view and labels the list item with it', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toHaveAttribute(
      'href',
      '/alerting/grafana/rule-1/view?returnTo=%2Falerting%2Frules%2Frecording%3Fsearch%3Dcpu'
    );
    expect(screen.getByRole('listitem', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
  });

  it('shows the Recording status icon when health is Recording', () => {
    renderRow({ searchHit: baseHit({ health: 'Recording' }) });

    expect(screen.getByLabelText('Recording')).toBeInTheDocument();
  });

  it('reads Status unavailable, never Recording, when the search hit carries no health', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });

  it.each([
    { name: 'is known', folderPath: ['Platform', 'Team Metrics'], shown: true },
    { name: 'is still loading', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    renderRow({ searchHit: baseHit(), folderPath });

    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByText('Team Metrics') !== null).toBe(shown);
  });

  it('shows the last error when the hit has one', () => {
    renderRow({ searchHit: baseHit({ lastError: 'remote write failed' }) });

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
  });

  it('shows no description when no error is present', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText('remote write failed')).not.toBeInTheDocument();
  });

  it('shows the evaluation interval', () => {
    renderRow({ searchHit: baseHit({ interval: '1m' }) });

    expect(screen.getByRole('img', { name: 'Evaluated every 1m' })).toBeInTheDocument();
  });

  it('shows no interval indicator when interval is absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByRole('img', { name: /Evaluated every/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
```

Expected: 4 new tests FAIL

- [ ] **Step 3: Update RecordingRuleRow**

Replace the entire `RecordingRuleRow.tsx`:

```tsx
import { useId } from 'react';

import { TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleInterval } from '../rule-row/RuleInterval';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleRowProps {
  searchHit: RecordingRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ searchHit, folderPath }: RecordingRuleRowProps) {
  const titleId = useId();
  const href = grafanaRulesNav.viewLink(searchHit.uid, { includeReturnTo: true });

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={searchHit.health} paused={searchHit.paused} />}
      title={
        <TextLink id={titleId} href={href} color="primary" inline={false}>
          {searchHit.title}
        </TextLink>
      }
      description={<RuleDescription lastError={searchHit.lastError} />}
      right={<RuleInterval interval={searchHit.interval} />}
      meta={[folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />]}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
```

Expected: PASS — all tests pass

- [ ] **Step 5: Run the full gma-rule-list test suite to check for regressions**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
git commit -m "feat(alerting): add description and interval to RecordingRuleRow"
```
