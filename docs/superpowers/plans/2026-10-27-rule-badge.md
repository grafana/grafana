# Plugin and Provisioning Badge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add plugin and provisioning badges after the rule title on both Alert and Recording rule rows, sourced from the full rule fetched per row via RTK Query.

**Architecture:** `RuleBadge` reads `spec.labels['__grafana_origin']` for the plugin badge and `metadata.annotations['grafana.com/provenance']` for the provisioning badge. The full rule fetch (`useGetAlertRuleQuery` / `useGetRecordingRuleQuery`) lives in the entry components; a failed fetch silently hides the badge. Both row components gain an optional `badge?: ReactNode` prop that renders inline after the title link.

**Tech Stack:** React, TypeScript, RTK Query (`@grafana/api-clients/rtkq/rules.alerting/v0alpha1`), MSW, Jest + React Testing Library

---

**Key paths (all under `public/app/features/alerting/unified/`):**

- `gma-rule-list/rule-row/RuleBadge.tsx` — new shared component
- `gma-rule-list/alert-rules/AlertRuleRow.tsx` — add `badge` prop
- `gma-rule-list/alert-rules/AlertRuleListEntry.tsx` — add full rule fetch
- `gma-rule-list/recording-rules/RecordingRuleRow.tsx` — add `badge` prop
- `gma-rule-list/recording-rules/RecordingRuleListEntry.tsx` — add full rule fetch

**Key existing utilities (read-only):**

- `plugins/PluginOriginBadge.tsx` — `PluginOriginBadge({ pluginId, size })` — renders plugin logo/badge in tooltip
- `components/Provisioning.tsx` — `ProvisioningBadge({ tooltip, provenance })` — renders "Provisioned" badge
- `utils/k8s/utils.ts` — `isK8sEntityProvisioned(entity)` — checks `grafana.com/provenance` annotation
- `mocks/server/handlers/k8s/alertRules.k8s.ts` — `getAlertRuleHandler(rules?)`, `mockK8sAlertRule({ uid, title })`
- `@grafana/api-clients/rtkq/rules.alerting/v0alpha1` — `useGetAlertRuleQuery({ name })`, `useGetRecordingRuleQuery({ name })`, `type AlertRule`, `type RecordingRule`, `API_GROUP`, `API_VERSION`

---

### Task 1: RuleBadge component

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleBadge.tsx`
- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `RuleBadge.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { ProvisioningBadge } from '../../components/Provisioning';

import { RuleBadge } from './RuleBadge';

// PluginOriginBadge loads plugin settings async; stub it for badge-logic tests.
jest.mock('../../plugins/PluginOriginBadge', () => ({
  PluginOriginBadge: ({ pluginId }: { pluginId: string }) => <span data-testid="plugin-badge">{pluginId}</span>,
}));

function makeRule(overrides: { labels?: Record<string, string>; annotations?: Record<string, string> }) {
  return {
    spec: { labels: overrides.labels },
    metadata: { annotations: overrides.annotations },
  };
}

describe('RuleBadge', () => {
  it('renders the plugin badge when __grafana_origin starts with plugin/', () => {
    render(<RuleBadge rule={makeRule({ labels: { __grafana_origin: 'plugin/grafana-ml-app' } })} />);

    expect(screen.getByTestId('plugin-badge')).toHaveTextContent('grafana-ml-app');
  });

  it('extracts the plugin ID after the plugin/ prefix', () => {
    render(<RuleBadge rule={makeRule({ labels: { __grafana_origin: 'plugin/my-cool-plugin' } })} />);

    expect(screen.getByTestId('plugin-badge')).toHaveTextContent('my-cool-plugin');
  });

  it('renders the provisioning badge when provenance is set and no plugin origin', () => {
    render(<RuleBadge rule={makeRule({ annotations: { 'grafana.com/provenance': 'terraform' } })} />);

    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it('renders the plugin badge and not the provisioning badge when both apply', () => {
    render(
      <RuleBadge
        rule={makeRule({
          labels: { __grafana_origin: 'plugin/grafana-ml-app' },
          annotations: { 'grafana.com/provenance': 'terraform' },
        })}
      />
    );

    expect(screen.getByTestId('plugin-badge')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('renders nothing when neither plugin origin nor provenance is set', () => {
    const { container } = render(<RuleBadge rule={makeRule({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when __grafana_origin does not start with plugin/', () => {
    render(<RuleBadge rule={makeRule({ labels: { __grafana_origin: 'terraform' } })} />);

    expect(screen.queryByTestId('plugin-badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleBadge.test.tsx
```

Expected: FAIL — `Cannot find module './RuleBadge'`

- [ ] **Step 3: Implement the component**

Create `RuleBadge.tsx`:

```tsx
import { type ReactNode } from 'react';

import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';

interface RuleBadgeProps {
  rule: {
    spec?: { labels?: Record<string, string> };
    metadata?: { annotations?: Record<string, string> };
  };
}

/**
 * Renders the plugin badge when __grafana_origin starts with "plugin/",
 * otherwise the provisioning badge when the rule is provisioned, otherwise nothing.
 * Plugin badge takes priority.
 */
export function RuleBadge({ rule }: RuleBadgeProps): ReactNode {
  const origin = rule.spec?.labels?.['__grafana_origin'];
  if (origin?.startsWith('plugin/')) {
    return <PluginOriginBadge pluginId={origin.slice('plugin/'.length)} size="sm" />;
  }
  if (isK8sEntityProvisioned(rule)) {
    const provenance = rule.metadata?.annotations?.['grafana.com/provenance'];
    return <ProvisioningBadge tooltip provenance={provenance} />;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleBadge.test.tsx
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/rule-row/RuleBadge.tsx \
        public/app/features/alerting/unified/gma-rule-list/rule-row/RuleBadge.test.tsx
git commit -m "feat(alerting): add RuleBadge component"
```

---

### Task 2: Add badge prop to AlertRuleRow

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx`

- [ ] **Step 1: Add failing test**

Append to `AlertRuleRow.test.tsx` (inside `describe`, after existing tests):

```tsx
it('renders the badge inline after the title when provided', () => {
  renderRow({ searchHit: baseHit(), badge: <span data-testid="test-badge">Badge</span> });

  expect(screen.getByTestId('test-badge')).toBeInTheDocument();
});

it('renders no badge when badge prop is absent', () => {
  renderRow({ searchHit: baseHit() });

  expect(screen.queryByTestId('test-badge')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
```

Expected: 2 new tests FAIL — `badge` prop does not exist

- [ ] **Step 3: Update AlertRuleRow**

Replace the entire `AlertRuleRow.tsx`:

```tsx
import { useId, type ReactNode } from 'react';

import { Stack, TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleDatasources } from '../rule-row/RuleDatasources';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleInterval } from '../rule-row/RuleInterval';
import { RuleLabels } from '../rule-row/RuleLabels';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleRowProps {
  searchHit: AlertRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
  /** Plugin or provisioning badge; absent while the full rule loads or when there is no badge. */
  badge?: ReactNode;
}

/** Presentation-only; missing state/health renders "unavailable", never healthy. */
export function AlertRuleRow({ searchHit, folderPath, badge }: AlertRuleRowProps) {
  const titleId = useId();

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="alert" state={searchHit.state} health={searchHit.health} paused={searchHit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
          <TextLink id={titleId} href={grafanaRulesNav.viewLink(searchHit.uid)} color="primary" inline={false}>
            {searchHit.title}
          </TextLink>
          {badge}
        </Stack>
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
        // parseSearchLabels guarantees labels is non-empty when present; RuleLabels handles the null case.
        searchHit.labels && <RuleLabels key="labels" labels={searchHit.labels} />,
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
git commit -m "feat(alerting): add badge prop to AlertRuleRow"
```

---

### Task 3: Wire badge into AlertRuleListEntry

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.test.tsx`

- [ ] **Step 1: Add failing tests**

Replace the entire `AlertRuleListEntry.test.tsx`:

```tsx
import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { mockK8sAlertRule, getAlertRuleHandler, FOLDER_PARENTS_URL } from '../mocks/handlers';

import { AlertRuleListEntry } from './AlertRuleListEntry';

const ALERT_RULE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default/alertrules/:name`;

const server = setupMswServer();

describe('AlertRuleListEntry', () => {
  it('shows the folder path from the folder parents lookup, root first', async () => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'root', title: 'Platform' },
            { name: 'folder-1', title: 'Team Alerts' },
          ],
        })
      )
    );

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high', folderUid: 'folder-1' }} />
      </ul>
    );

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Platform').compareDocumentPosition(screen.getByText('Team Alerts'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('shows the provisioning badge after the full rule loads with provenance set', async () => {
    server.use(
      getAlertRuleHandler([
        {
          ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
          metadata: {
            name: 'rule-1',
            annotations: { 'grafana.com/provenance': 'terraform' },
          },
        },
      ])
    );

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high' }} />
      </ul>
    );

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });

  it('shows no badge when the full rule fetch fails', async () => {
    server.use(
      http.get(ALERT_RULE_URL, () =>
        HttpResponse.json({ kind: 'Status', status: 'Failure', code: 500 }, { status: 500 })
      )
    );

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high' }} />
      </ul>
    );

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows no badge when the full rule has no provenance and no plugin origin', async () => {
    server.use(getAlertRuleHandler([mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' })]));

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high' }} />
      </ul>
    );

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.test.tsx
```

Expected: 3 new tests FAIL — `mockK8sAlertRule` and `getAlertRuleHandler` not exported from handlers, badge not rendered

- [ ] **Step 3: Export the mock helpers from handlers index**

The MSW mock helpers `mockK8sAlertRule` and `getAlertRuleHandler` are in `mocks/server/handlers/k8s/alertRules.k8s.ts` but need to be accessible from the test. Re-export them from `gma-rule-list/mocks/handlers.ts`:

In `public/app/features/alerting/unified/gma-rule-list/mocks/handlers.ts`, add at the end:

```ts
export { mockK8sAlertRule, getAlertRuleHandler } from '../../mocks/server/handlers/k8s/alertRules.k8s';
```

- [ ] **Step 4: Implement the entry component changes**

Replace the entire `AlertRuleListEntry.tsx`:

```tsx
import { useGetAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';
import { RuleBadge } from '../rule-row/RuleBadge';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  searchHit: AlertRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function AlertRuleListEntry({ searchHit }: AlertRuleListEntryProps) {
  const folderPath = useFolderPath(searchHit.folderUid);
  const { data: fullRule } = useGetAlertRuleQuery({ name: searchHit.uid });
  const badge = fullRule ? <RuleBadge rule={fullRule} /> : undefined;

  return <AlertRuleRow searchHit={searchHit} folderPath={folderPath} badge={badge} />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.test.tsx
```

Expected: PASS — all 4 tests pass

- [ ] **Step 6: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.tsx \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.test.tsx \
        public/app/features/alerting/unified/gma-rule-list/mocks/handlers.ts
git commit -m "feat(alerting): wire badge into AlertRuleListEntry via full rule fetch"
```

---

### Task 4: Add badge prop to RecordingRuleRow

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `RecordingRuleRow.test.tsx` (inside `describe`, after existing tests):

```tsx
it('renders the badge inline after the title when provided', () => {
  renderRow({ searchHit: baseHit(), badge: <span data-testid="test-badge">Badge</span> });

  expect(screen.getByTestId('test-badge')).toBeInTheDocument();
});

it('renders no badge when badge prop is absent', () => {
  renderRow({ searchHit: baseHit() });

  expect(screen.queryByTestId('test-badge')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
```

Expected: 2 new tests FAIL

- [ ] **Step 3: Update RecordingRuleRow**

Replace the entire `RecordingRuleRow.tsx`:

```tsx
import { useId, type ReactNode } from 'react';

import { Stack, TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleDatasources } from '../rule-row/RuleDatasources';
import { RuleDescription } from '../rule-row/RuleDescription';
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
  /** Plugin or provisioning badge; absent while the full rule loads or when there is no badge. */
  badge?: ReactNode;
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ searchHit, folderPath, badge }: RecordingRuleRowProps) {
  const titleId = useId();
  const href = grafanaRulesNav.viewLink(searchHit.uid, { includeReturnTo: true });
  // The write target is already shown in RuleRecordedMetric; exclude it from the queried list.
  const queriedUIDs = searchHit.datasourceUIDs?.filter((uid) => uid !== searchHit.targetDatasourceUID);

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={searchHit.health} paused={searchHit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
          <TextLink id={titleId} href={href} color="primary" inline={false}>
            {searchHit.title}
          </TextLink>
          {badge}
        </Stack>
      }
      description={searchHit.lastError && <RuleDescription lastError={searchHit.lastError} />}
      right={searchHit.interval && <RuleInterval interval={searchHit.interval} />}
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        // Both metric and targetDatasourceUID are required: showing "Records X to <unknown>" without
        // a destination makes no sense, and showing just the datasource without context is confusing.
        searchHit.metric && searchHit.targetDatasourceUID && (
          <RuleRecordedMetric
            key="metric"
            metric={searchHit.metric}
            targetDatasourceUID={searchHit.targetDatasourceUID}
          />
        ),
        queriedUIDs && queriedUIDs.length > 0 && <RuleDatasources key="ds" datasourceUIDs={queriedUIDs} />,
        // parseSearchLabels guarantees labels is non-empty when present; RuleLabels handles the null case.
        searchHit.labels && <RuleLabels key="labels" labels={searchHit.labels} />,
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

- [ ] **Step 5: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
git commit -m "feat(alerting): add badge prop to RecordingRuleRow"
```

---

### Task 5: Wire badge into RecordingRuleListEntry

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.test.tsx`

- [ ] **Step 1: Add failing tests**

Replace the entire `RecordingRuleListEntry.test.tsx`:

```tsx
import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { FOLDER_PARENTS_URL } from '../mocks/handlers';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';

const RECORDING_RULE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default/recordingrules/:name`;

function mockRecordingRuleHandler(overrides: { annotations?: Record<string, string> } = {}) {
  return http.get<{ name: string }>(RECORDING_RULE_URL, ({ params: { name } }) =>
    HttpResponse.json({
      apiVersion: `${API_GROUP}/${API_VERSION}`,
      kind: 'RecordingRule',
      metadata: { name, annotations: overrides.annotations ?? {} },
      spec: {
        title: 'cpu:usage:rate5m',
        metric: 'cpu:usage:rate5m',
        targetDatasourceUID: 'gdev-prometheus',
        trigger: { interval: '1m' },
        expressions: {},
      },
    })
  );
}

const server = setupMswServer();

describe('RecordingRuleListEntry', () => {
  it('shows the folder path from the folder parents lookup, root first', async () => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'root', title: 'Platform' },
            { name: 'folder-1', title: 'Team Metrics' },
          ],
        })
      )
    );

    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m', folderUid: 'folder-1' }} />
      </ul>
    );

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Platform').compareDocumentPosition(screen.getByText('Team Metrics'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('shows the provisioning badge after the full rule loads with provenance set', async () => {
    server.use(mockRecordingRuleHandler({ annotations: { 'grafana.com/provenance': 'terraform' } }));

    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m' }} />
      </ul>
    );

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });

  it('shows no badge when the full rule fetch fails', async () => {
    server.use(
      http.get(RECORDING_RULE_URL, () =>
        HttpResponse.json({ kind: 'Status', status: 'Failure', code: 500 }, { status: 500 })
      )
    );

    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m' }} />
      </ul>
    );

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows no badge when the full rule has no provenance and no plugin origin', async () => {
    server.use(mockRecordingRuleHandler());

    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m' }} />
      </ul>
    );

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.test.tsx
```

Expected: 3 new tests FAIL — badge not rendered

- [ ] **Step 3: Implement the entry component changes**

Replace the entire `RecordingRuleListEntry.tsx`:

```tsx
import { useGetRecordingRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';
import { RuleBadge } from '../rule-row/RuleBadge';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  searchHit: RecordingRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function RecordingRuleListEntry({ searchHit }: RecordingRuleListEntryProps) {
  const folderPath = useFolderPath(searchHit.folderUid);
  const { data: fullRule } = useGetRecordingRuleQuery({ name: searchHit.uid });
  const badge = fullRule ? <RuleBadge rule={fullRule} /> : undefined;

  return <RecordingRuleRow searchHit={searchHit} folderPath={folderPath} badge={badge} />;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.test.tsx
```

Expected: PASS — all 4 tests pass

- [ ] **Step 5: Run full suite and check for regressions**

```sh
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```sh
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.test.tsx
git commit -m "feat(alerting): wire badge into RecordingRuleListEntry via full rule fetch"
```
