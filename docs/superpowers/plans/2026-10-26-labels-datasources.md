# Labels and Datasources in GMA-only Rule Rows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add labels pill, queried datasources, and (Recording-only) "Records metric to" metadata to the GMA-only Alert and Recording rule rows.

**Architecture:** Extend both search queries and hit schemas to request and parse `labels`, `datasourceUIDs`, `metric`, `targetDatasourceUID`. Build three new components (`RuleDatasources`, `RuleLabels`, `RuleRecordedMetric`) and wire them into the row `meta` arrays. Datasource lookup is synchronous via `getDataSourceByUid` from the Redux store — no extra API calls. TDD throughout.

**Tech Stack:** React, TypeScript, Zod, Grafana UI, `@grafana/alerting/unstable` (AlertLabels), Jest + React Testing Library

---

**Key paths (all under `public/app/features/alerting/unified/`):**

- `gma-rule-list/alert-rules/alertRuleSearchHit.ts` — hit schema + `parseSearchLabels` helper
- `gma-rule-list/alert-rules/alertRuleSearchQuery.ts`
- `gma-rule-list/recording-rules/recordingRuleSearchHit.ts`
- `gma-rule-list/recording-rules/recordingRuleSearchQuery.ts`
- `gma-rule-list/rule-row/RuleDatasources.tsx` — shared, exports `DataSourceLogo`
- `gma-rule-list/rule-row/RuleLabels.tsx` — shared
- `gma-rule-list/recording-rules/RuleRecordedMetric.tsx` — Recording-only
- `gma-rule-list/alert-rules/AlertRuleRow.tsx`
- `gma-rule-list/recording-rules/RecordingRuleRow.tsx`

**Key utilities (read-only, do not modify):**

- `utils/datasource.ts` — `getDataSourceByUid(uid): DataSourceInstanceSettings | undefined`
- `utils/misc.ts` — `makeDataSourceLink(uid): string`
- `utils/labels.ts` — `labelsSize(labels): number`, `isPrivateLabelKey(key): boolean`
- `types/unified-alerting-dto` — `Labels = Record<string, string>`
- `mocks.ts` — `mockDataSource(partial?): DataSourceInstanceSettings`
- `testSetup/datasources.ts` — `setupDataSources(...configs): void`

---

### Task 1: Alert search query — add labels and datasourceUIDs

**Files:**

- Modify: `gma-rule-list/alert-rules/alertRuleSearchQuery.ts`
- Modify: `gma-rule-list/alert-rules/alertRuleSearchQuery.test.ts`

- [ ] **Step 1: Update the test**

Replace `alertRuleSearchQuery.test.ts`:

```ts
import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

describe('buildAlertRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows', () => {
    expect(buildAlertRuleSearchQuery()).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      sort: [{ field: 'title', direction: 'asc' }],
      fields: [
        'title',
        'folder',
        'paused',
        'state',
        'health',
        'lastError',
        'annotations',
        'interval',
        'labels',
        'datasourceUIDs',
      ],
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

- [ ] **Step 3: Add the new fields**

In `alertRuleSearchQuery.ts`, replace the `ALERT_RULE_FIELDS` constant:

```ts
// `state`, `health`, and `lastError` are status fields populated by `alerting.ruleStatusSync`.
// `annotations` returns as a JSON-encoded string; `interval` is the evaluation cadence.
// `labels` returns as a flat string array ("key" and "key=value" entries); `datasourceUIDs` as a string array.
const ALERT_RULE_FIELDS = [
  'title',
  'folder',
  'paused',
  'state',
  'health',
  'lastError',
  'annotations',
  'interval',
  'labels',
  'datasourceUIDs',
];
```

- [ ] **Step 4: Run test to verify it passes**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.test.ts
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.ts \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.test.ts
git commit -m "feat(alerting): request labels and datasourceUIDs in alert rule search"
```

---

### Task 2: Alert search hit — add parseSearchLabels, labels, datasourceUIDs

**Files:**

- Modify: `gma-rule-list/alert-rules/alertRuleSearchHit.ts`
- Modify: `gma-rule-list/alert-rules/alertRuleSearchHit.test.ts`

- [ ] **Step 1: Add tests for the new fields**

Append to `alertRuleSearchHit.test.ts` (after the existing `it` blocks, inside the `describe`):

```ts
it('parses key=value label entries into a Labels object, filtering private keys', () => {
  const hit = toHit({
    labels: ['team=platform', 'env=prod', '__grafana_origin=plugin-xyz', '__private__=hidden', 'env'],
  });

  expect(hit.labels).toEqual({ team: 'platform', env: 'prod' });
});

it('leaves labels unset when the array is empty or has no key=value entries', () => {
  expect(toHit({ labels: [] }).labels).toBeUndefined();
  expect(toHit({ labels: ['team', 'env'] }).labels).toBeUndefined();
  expect(toHit({}).labels).toBeUndefined();
});

it('leaves labels unset when the field is not an array', () => {
  expect(toHit({ labels: 'team=platform' }).labels).toBeUndefined();
});

it('stores datasourceUIDs as-is', () => {
  const hit = toHit({ datasourceUIDs: ['ds-1', 'ds-2'] });
  expect(hit.datasourceUIDs).toEqual(['ds-1', 'ds-2']);
});

it('leaves datasourceUIDs unset when absent or not an array', () => {
  expect(toHit({}).datasourceUIDs).toBeUndefined();
  expect(toHit({ datasourceUIDs: 'ds-1' }).datasourceUIDs).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.test.ts
```

Expected: FAIL — `labels` and `datasourceUIDs` not on hit

- [ ] **Step 3: Implement the changes**

Replace the entire `alertRuleSearchHit.ts`:

```ts
import * as z from 'zod';

import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type Labels } from 'app/types/unified-alerting-dto';

import { isPrivateLabelKey } from '../../utils/labels';

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
  /** Rule labels with private keys excluded; absent when none remain. */
  labels?: Labels;
  /** UIDs of data sources queried by the rule's expressions. */
  datasourceUIDs?: string[];
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

// annotations comes back as a JSON-encoded string; parse it safely via Zod.
const annotationsSchema = z.record(z.string(), z.string());

function tryParseAnnotations(s: string): Record<string, string> | undefined {
  try {
    return annotationsSchema.parse(JSON.parse(s));
  } catch {
    return undefined;
  }
}

/**
 * Converts the search API's flat label strings ("key" and "key=value") into a Labels object.
 * Ignores key-only entries (used for filter matching) and private label keys.
 * Exported for reuse in recordingRuleSearchHit.ts.
 */
export function parseSearchLabels(entries?: string[]): Labels | undefined {
  if (!entries?.length) {
    return undefined;
  }
  const result: Labels = {};
  for (const entry of entries) {
    const eq = entry.indexOf('=');
    if (eq > 0) {
      const key = entry.slice(0, eq);
      if (!isPrivateLabelKey(key)) {
        result[key] = entry.slice(eq + 1);
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
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
  labels: z.array(z.string()).optional().catch(undefined),
  datasourceUIDs: z.array(z.string()).optional().catch(undefined),
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
      summary: fields.annotations?.summary,
      interval: fields.interval,
      labels: parseSearchLabels(fields.labels),
      datasourceUIDs: fields.datasourceUIDs,
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
git commit -m "feat(alerting): add labels and datasourceUIDs to AlertRuleSearchHit"
```

---

### Task 3: Recording search query — add labels, datasourceUIDs, metric, targetDatasourceUID

**Files:**

- Modify: `gma-rule-list/recording-rules/recordingRuleSearchQuery.ts`
- Modify: `gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts`

- [ ] **Step 1: Update the test**

Replace `recordingRuleSearchQuery.test.ts`:

```ts
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

describe('buildRecordingRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows, without a state field', () => {
    expect(buildRecordingRuleSearchQuery()).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      sort: [{ field: 'title', direction: 'asc' }],
      fields: [
        'title',
        'folder',
        'paused',
        'health',
        'lastError',
        'interval',
        'labels',
        'datasourceUIDs',
        'metric',
        'targetDatasourceUID',
      ],
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

- [ ] **Step 3: Add the new fields**

In `recordingRuleSearchQuery.ts`, replace the `RECORDING_RULE_FIELDS` constant:

```ts
// `health` and `lastError` are status fields populated by `alerting.ruleStatusSync`.
// Recording rules have no annotations field; `interval` is the evaluation cadence.
// `labels` and `datasourceUIDs` are arrays; `metric` and `targetDatasourceUID` are direct strings.
const RECORDING_RULE_FIELDS = [
  'title',
  'folder',
  'paused',
  'health',
  'lastError',
  'interval',
  'labels',
  'datasourceUIDs',
  'metric',
  'targetDatasourceUID',
];
```

- [ ] **Step 4: Run test to verify it passes**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.ts \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchQuery.test.ts
git commit -m "feat(alerting): request labels, datasourceUIDs, metric and targetDatasourceUID in recording rule search"
```

---

### Task 4: Recording search hit — add labels, datasourceUIDs, metric, targetDatasourceUID

**Files:**

- Modify: `gma-rule-list/recording-rules/recordingRuleSearchHit.ts`
- Modify: `gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts`

- [ ] **Step 1: Add tests for the new fields**

Append to `recordingRuleSearchHit.test.ts` (inside the `describe`, after existing tests):

```ts
it('parses labels using the same rules as alert rules — key=value only, private keys excluded', () => {
  const hit = toHit({ labels: ['team=platform', '__grafana_origin=plugin', 'env'] });
  expect(hit.labels).toEqual({ team: 'platform' });
});

it('leaves labels unset when absent or empty', () => {
  expect(toHit({}).labels).toBeUndefined();
  expect(toHit({ labels: [] }).labels).toBeUndefined();
});

it('stores datasourceUIDs as-is', () => {
  const hit = toHit({ datasourceUIDs: ['ds-1'] });
  expect(hit.datasourceUIDs).toEqual(['ds-1']);
});

it('reads metric from the search hit', () => {
  expect(toHit({ metric: 'cpu:usage:rate5m' }).metric).toBe('cpu:usage:rate5m');
});

it('reads targetDatasourceUID from the search hit', () => {
  expect(toHit({ targetDatasourceUID: 'ds-prom' }).targetDatasourceUID).toBe('ds-prom');
});

it('leaves metric and targetDatasourceUID unset when absent', () => {
  expect(toHit({}).metric).toBeUndefined();
  expect(toHit({}).targetDatasourceUID).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/recordingRuleSearchHit.test.ts
```

Expected: FAIL — new fields not on hit

- [ ] **Step 3: Implement the changes**

Replace the entire `recordingRuleSearchHit.ts`:

```ts
import * as z from 'zod';

import { type RecordingRuleRecordingRuleHealth } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type Labels } from 'app/types/unified-alerting-dto';

import { parseSearchLabels } from '../alert-rules/alertRuleSearchHit';

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
  /** Rule labels with private keys excluded; absent when none remain. */
  labels?: Labels;
  /** UIDs of data sources queried by the rule's expressions. */
  datasourceUIDs?: string[];
  /** The name of the recorded metric. */
  metric?: string;
  /** UID of the datasource the metric is written to. */
  targetDatasourceUID?: string;
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
  labels: z.array(z.string()).optional().catch(undefined),
  datasourceUIDs: z.array(z.string()).optional().catch(undefined),
  metric: z.string().optional().catch(undefined),
  targetDatasourceUID: z.string().optional().catch(undefined),
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
      labels: parseSearchLabels(fields.labels),
      datasourceUIDs: fields.datasourceUIDs,
      metric: fields.metric,
      targetDatasourceUID: fields.targetDatasourceUID,
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
git commit -m "feat(alerting): add labels, datasourceUIDs, metric, targetDatasourceUID to RecordingRuleSearchHit"
```

---

### Task 5: RuleDatasources component

**Files:**

- Create: `gma-rule-list/rule-row/RuleDatasources.tsx`
- Create: `gma-rule-list/rule-row/RuleDatasources.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `RuleDatasources.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import { RuleDatasources } from './RuleDatasources';

describe('RuleDatasources', () => {
  it('shows a single datasource as logo and name link', () => {
    setupDataSources(mockDataSource({ uid: 'ds-1', name: 'Prometheus' }));

    render(<RuleDatasources datasourceUIDs={['ds-1']} />);

    expect(screen.getByRole('link', { name: 'Prometheus' })).toHaveAttribute('href', expect.stringContaining('ds-1'));
  });

  it('shows multiple datasources as logos and a count', () => {
    setupDataSources(
      mockDataSource({ uid: 'ds-1', name: 'Prometheus' }),
      mockDataSource({ uid: 'ds-2', name: 'Loki' })
    );

    render(<RuleDatasources datasourceUIDs={['ds-1', 'ds-2']} />);

    expect(screen.getByText('2 data sources')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('deduplicates repeated UIDs', () => {
    setupDataSources(mockDataSource({ uid: 'ds-1', name: 'Prometheus' }));

    render(<RuleDatasources datasourceUIDs={['ds-1', 'ds-1']} />);

    expect(screen.getByRole('link', { name: 'Prometheus' })).toBeInTheDocument();
    expect(screen.queryByText('2 data sources')).not.toBeInTheDocument();
  });

  it('renders nothing when no UIDs are given', () => {
    const { container } = render(<RuleDatasources datasourceUIDs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when none of the UIDs resolve to a known datasource', () => {
    const { container } = render(<RuleDatasources datasourceUIDs={['unknown-uid']} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDatasources.test.tsx
```

Expected: FAIL — `Cannot find module './RuleDatasources'`

- [ ] **Step 3: Implement the component**

Create `RuleDatasources.tsx`:

```tsx
import { cx, css } from '@emotion/css';
import { forwardRef } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';

import { getDataSourceByUid } from '../../utils/datasource';
import { makeDataSourceLink } from '../../utils/misc';

interface RuleDatasourcesProps {
  datasourceUIDs: string[];
}

export function RuleDatasources({ datasourceUIDs }: RuleDatasourcesProps) {
  const dataSources = Array.from(new Set(datasourceUIDs))
    .map(getDataSourceByUid)
    .filter((ds): ds is DataSourceInstanceSettings => ds !== undefined);

  if (dataSources.length === 0) {
    return null;
  }

  const singleSource = dataSources.length === 1;
  const firstSource = dataSources[0];

  const label = singleSource
    ? firstSource.name
    : t('alerting.gma-rule-list.datasources', '{{numSources}} data sources', {
        numSources: dataSources.length,
      });

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {singleSource ? (
        <DataSourceLogo dataSource={firstSource} />
      ) : (
        dataSources.map((ds) => (
          <Tooltip key={ds.uid} content={ds.name}>
            <DataSourceLogo dataSource={ds} />
          </Tooltip>
        ))
      )}
      {singleSource ? (
        <TextLink variant="bodySmall" inline={false} color="primary" href={makeDataSourceLink(firstSource.uid)}>
          {label}
        </TextLink>
      ) : (
        <Text variant="bodySmall" color="primary">
          {label}
        </Text>
      )}
    </Stack>
  );
}

/** Datasource logo image; exported for use in other row metadata components. */
export const DataSourceLogo = forwardRef<HTMLImageElement, { dataSource: DataSourceInstanceSettings }>(
  ({ dataSource }, ref) => {
    const styles = useStyles2(getLogoStyles);
    return (
      <img
        ref={ref}
        className={cx(styles.logo, { [styles.filter]: dataSource.meta.builtIn })}
        alt={`${dataSource.meta.name} logo`}
        src={dataSource.meta.info.logos.small}
      />
    );
  }
);
DataSourceLogo.displayName = 'DataSourceLogo';

const getLogoStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    height: '12px',
    width: '12px',
    borderRadius: theme.shape.radius.default,
  }),
  filter: css({
    filter: theme.isDark ? 'invert(1) brightness(2)' : 'none',
  }),
});
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDatasources.test.tsx
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDatasources.tsx \
        public/app/features/alerting/unified/gma-rule-list/rule-row/RuleDatasources.test.tsx
git commit -m "feat(alerting): add RuleDatasources component"
```

---

### Task 6: RuleLabels component

**Files:**

- Create: `gma-rule-list/rule-row/RuleLabels.tsx`
- Create: `gma-rule-list/rule-row/RuleLabels.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `RuleLabels.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { RuleLabels } from './RuleLabels';

describe('RuleLabels', () => {
  it('shows the label count', () => {
    render(<RuleLabels labels={{ team: 'platform', env: 'prod' }} />);

    expect(screen.getByText('2 labels')).toBeInTheDocument();
  });

  it('shows "1 label" for a single label', () => {
    render(<RuleLabels labels={{ team: 'platform' }} />);

    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('renders nothing when the labels object is empty', () => {
    const { container } = render(<RuleLabels labels={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleLabels.test.tsx
```

Expected: FAIL — `Cannot find module './RuleLabels'`

- [ ] **Step 3: Implement the component**

Create `RuleLabels.tsx`:

```tsx
import { AlertLabels } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip } from '@grafana/ui';

import { type Labels } from 'app/types/unified-alerting-dto';

import { labelsSize } from '../../utils/labels';

interface RuleLabelsProps {
  labels: Labels;
}

export function RuleLabels({ labels }: RuleLabelsProps) {
  const count = labelsSize(labels);
  if (count === 0) {
    return null;
  }

  const text = t('alerting.gma-rule-list.labels', '', {
    count,
    formatted: String(count),
    defaultValue_one: '{{formatted}} label',
    defaultValue_other: '{{formatted}} labels',
  });

  return (
    <Tooltip content={<AlertLabels labels={labels} size="sm" />} placement="right" interactive>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="tag-alt" size="xs" />
        <Text variant="bodySmall" color="primary">
          {text}
        </Text>
      </Stack>
    </Tooltip>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleLabels.test.tsx
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/rule-row/RuleLabels.tsx \
        public/app/features/alerting/unified/gma-rule-list/rule-row/RuleLabels.test.tsx
git commit -m "feat(alerting): add RuleLabels component"
```

---

### Task 7: RuleRecordedMetric component (Recording-only)

**Files:**

- Create: `gma-rule-list/recording-rules/RuleRecordedMetric.tsx`
- Create: `gma-rule-list/recording-rules/RuleRecordedMetric.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `RuleRecordedMetric.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import { RuleRecordedMetric } from './RuleRecordedMetric';

describe('RuleRecordedMetric', () => {
  it('shows the metric name and target datasource name as a link', () => {
    setupDataSources(mockDataSource({ uid: 'ds-mimir', name: 'Mimir' }));

    render(<RuleRecordedMetric metric="cpu:usage:rate5m" targetDatasourceUID="ds-mimir" />);

    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mimir' })).toHaveAttribute('href', expect.stringContaining('ds-mimir'));
  });

  it('falls back to the UID as plain text when the datasource does not resolve', () => {
    render(<RuleRecordedMetric metric="cpu:usage:rate5m" targetDatasourceUID="unknown-uid" />);

    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByText('unknown-uid')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RuleRecordedMetric.test.tsx
```

Expected: FAIL — `Cannot find module './RuleRecordedMetric'`

- [ ] **Step 3: Implement the component**

Create `RuleRecordedMetric.tsx`:

```tsx
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink } from '@grafana/ui';

import { getDataSourceByUid } from '../../utils/datasource';
import { makeDataSourceLink } from '../../utils/misc';
import { DataSourceLogo } from '../rule-row/RuleDatasources';

interface RuleRecordedMetricProps {
  metric: string;
  targetDatasourceUID: string;
}

export function RuleRecordedMetric({ metric, targetDatasourceUID }: RuleRecordedMetricProps) {
  const dataSource = getDataSourceByUid(targetDatasourceUID);

  return (
    <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
      <Text variant="bodySmall" color="secondary">
        {t('alerting.gma-rule-list.recorded-metric.records', 'Records')}
      </Text>
      <Text variant="bodySmall" color="primary">
        {metric}
      </Text>
      <Text variant="bodySmall" color="secondary">
        {t('alerting.gma-rule-list.recorded-metric.to', 'to')}
      </Text>
      {dataSource ? (
        <>
          <DataSourceLogo dataSource={dataSource} />
          <TextLink variant="bodySmall" inline={false} color="primary" href={makeDataSourceLink(targetDatasourceUID)}>
            {dataSource.name}
          </TextLink>
        </>
      ) : (
        <Text variant="bodySmall" color="primary">
          {targetDatasourceUID}
        </Text>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RuleRecordedMetric.test.tsx
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RuleRecordedMetric.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RuleRecordedMetric.test.tsx
git commit -m "feat(alerting): add RuleRecordedMetric component"
```

---

### Task 8: Wire AlertRuleRow

**Files:**

- Modify: `gma-rule-list/alert-rules/AlertRuleRow.tsx`
- Modify: `gma-rule-list/alert-rules/AlertRuleRow.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `AlertRuleRow.test.tsx` (inside `describe`, after existing tests):

```tsx
it('shows queried datasources when the hit has them', () => {
  setupDataSources(mockDataSource({ uid: 'ds-prom', name: 'Prometheus' }));
  renderRow({ searchHit: baseHit({ datasourceUIDs: ['ds-prom'] }) });

  expect(screen.getByRole('link', { name: 'Prometheus' })).toBeInTheDocument();
});

it('shows no datasources when the hit has none', () => {
  renderRow({ searchHit: baseHit() });

  expect(screen.queryByRole('link', { name: /data source/i })).not.toBeInTheDocument();
});

it('shows labels when the hit has them', () => {
  renderRow({ searchHit: baseHit({ labels: { team: 'platform', env: 'prod' } }) });

  expect(screen.getByText('2 labels')).toBeInTheDocument();
});

it('shows no labels when the hit has none', () => {
  renderRow({ searchHit: baseHit() });

  expect(screen.queryByText(/label/)).not.toBeInTheDocument();
});
```

Also add `mockDataSource` and `setupDataSources` imports to the top of the test file:

```tsx
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
```

- [ ] **Step 2: Run tests to verify new ones fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
```

Expected: 4 new tests FAIL

- [ ] **Step 3: Update AlertRuleRow**

Replace the entire `AlertRuleRow.tsx`:

```tsx
import { useId } from 'react';

import { TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { labelsSize } from '../../utils/labels';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleDatasources } from '../rule-row/RuleDatasources';
import { RuleInterval } from '../rule-row/RuleInterval';
import { RuleLabels } from '../rule-row/RuleLabels';
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
      description={
        (searchHit.lastError || searchHit.summary) && (
          <RuleDescription lastError={searchHit.lastError} summary={searchHit.summary} />
        )
      }
      right={searchHit.interval && <RuleInterval interval={searchHit.interval} />}
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        searchHit.datasourceUIDs && searchHit.datasourceUIDs.length > 0 && (
          <RuleDatasources key="ds" datasourceUIDs={searchHit.datasourceUIDs} />
        ),
        searchHit.labels && labelsSize(searchHit.labels) > 0 && <RuleLabels key="labels" labels={searchHit.labels} />,
      ]}
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
git commit -m "feat(alerting): add datasources and labels to AlertRuleRow"
```

---

### Task 9: Wire RecordingRuleRow

**Files:**

- Modify: `gma-rule-list/recording-rules/RecordingRuleRow.tsx`
- Modify: `gma-rule-list/recording-rules/RecordingRuleRow.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `RecordingRuleRow.test.tsx` (inside `describe`, after existing tests):

```tsx
it('shows the recorded metric and target datasource when the hit has them', () => {
  setupDataSources(mockDataSource({ uid: 'ds-mimir', name: 'Mimir' }));
  renderRow({
    searchHit: baseHit({ metric: 'cpu:usage:rate5m', targetDatasourceUID: 'ds-mimir' }),
  });

  expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mimir' })).toBeInTheDocument();
});

it('shows no recorded metric when metric or targetDatasourceUID is absent', () => {
  renderRow({ searchHit: baseHit() });

  expect(screen.queryByText(/Records/)).not.toBeInTheDocument();
});

it('shows queried datasources when the hit has them', () => {
  setupDataSources(mockDataSource({ uid: 'ds-prom', name: 'Prometheus' }));
  renderRow({ searchHit: baseHit({ datasourceUIDs: ['ds-prom'] }) });

  expect(screen.getByRole('link', { name: 'Prometheus' })).toBeInTheDocument();
});

it('shows labels when the hit has them', () => {
  renderRow({ searchHit: baseHit({ labels: { team: 'infra' } }) });

  expect(screen.getByText('1 label')).toBeInTheDocument();
});
```

Also add `mockDataSource` and `setupDataSources` imports:

```tsx
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
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
import { labelsSize } from '../../utils/labels';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleDatasources } from '../rule-row/RuleDatasources';
import { RuleInterval } from '../rule-row/RuleInterval';
import { RuleLabels } from '../rule-row/RuleLabels';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { RuleRecordedMetric } from './RuleRecordedMetric';
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
      description={searchHit.lastError && <RuleDescription lastError={searchHit.lastError} />}
      right={searchHit.interval && <RuleInterval interval={searchHit.interval} />}
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        searchHit.metric && searchHit.targetDatasourceUID && (
          <RuleRecordedMetric
            key="metric"
            metric={searchHit.metric}
            targetDatasourceUID={searchHit.targetDatasourceUID}
          />
        ),
        searchHit.datasourceUIDs && searchHit.datasourceUIDs.length > 0 && (
          <RuleDatasources key="ds" datasourceUIDs={searchHit.datasourceUIDs} />
        ),
        searchHit.labels && labelsSize(searchHit.labels) > 0 && <RuleLabels key="labels" labels={searchHit.labels} />,
      ]}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
```

Expected: PASS — all tests pass

- [ ] **Step 5: Run the full gma-rule-list suite**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/
```

Expected: all tests pass

- [ ] **Step 6: Run i18n extract**

```sh
make i18n-extract 2>&1 | tail -5
```

Expected: extraction complete. If `public/locales/en-US/grafana.json` changed, stage and commit it alongside the next commit or as a separate commit.

- [ ] **Step 7: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
git commit -m "feat(alerting): add recorded metric, datasources and labels to RecordingRuleRow"
```
