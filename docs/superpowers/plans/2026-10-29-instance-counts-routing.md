# Instance counts and routing in Alert rule rows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-state instance counts (linked to the instances tab) and routing info ("Delivered to" / "Policy:" / "Default policy") to the meta strip of GMA-only Alert rule rows.

**Architecture:** Two new presentational components (`RuleInstanceCounts`, `RuleRouting`) read data already on the search hit. The search query and hit schema are extended to request and parse the new fields. Both components are added to `AlertRuleRow`'s existing `meta` array — no layout changes needed.

**Tech Stack:** React, TypeScript, Zod, `@grafana/ui`, `@grafana/i18n`, MSW + React Testing Library for tests.

---

## File map

| File                                                                                      | Action                                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.ts`  | Modify — add 9 fields to `ALERT_RULE_FIELDS`                    |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.ts`    | Modify — add fields to zod schema and `AlertRuleSearchHit` type |
| `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.tsx`      | Create                                                          |
| `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.test.tsx` | Create                                                          |
| `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.tsx`             | Create                                                          |
| `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.test.tsx`        | Create                                                          |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx`         | Modify — add both to `meta`                                     |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx`    | Modify — add cases                                              |

All paths are relative to the repo root `/Users/cbujanos/work/grafana`.

---

## Task 1: Extend the search query and hit schema

Adds the 9 new fields to what the search API requests, and teaches the zod schema how to parse them.

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.ts`
- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.ts`

- [ ] **Step 1: Add fields to `ALERT_RULE_FIELDS` in `alertRuleSearchQuery.ts`**

Open the file. Find the `ALERT_RULE_FIELDS` array at the bottom. Add the 9 new fields:

```ts
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
  // instance counts (populated only when alerting.ruleStatusSync is on)
  'totalsHealthy',
  'totalsFiring',
  'totalsPending',
  'totalsRecovering',
  'totalsNoData',
  'totalsError',
  // routing
  'notificationType',
  'receiver',
  'routingTree',
];
```

- [ ] **Step 2: Add the new fields to `AlertRuleSearchHit` in `alertRuleSearchHit.ts`**

Open the file. Add to the `AlertRuleSearchHit` interface:

```ts
export interface AlertRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  state?: AlertRuleAlertRuleState;
  health?: AlertRuleAlertRuleHealth;
  lastError?: string;
  summary?: string;
  interval?: string;
  labels?: Labels;
  datasourceUIDs?: string[];
  // instance counts — absent when alerting.ruleStatusSync is off or not yet synced
  totalsHealthy?: number;
  totalsFiring?: number;
  totalsPending?: number;
  totalsRecovering?: number;
  totalsNoData?: number;
  totalsError?: number;
  // routing
  notificationType?: 'SimplifiedRouting' | 'NamedRoutingTree';
  receiver?: string;
  routingTree?: string;
}
```

- [ ] **Step 3: Add fields to the zod schema in `alertRuleSearchHit.ts`**

In the same file, find `alertRuleSearchFieldsSchema`. Add after `datasourceUIDs`:

```ts
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
  totalsHealthy: z.number().optional().catch(undefined),
  totalsFiring: z.number().optional().catch(undefined),
  totalsPending: z.number().optional().catch(undefined),
  totalsRecovering: z.number().optional().catch(undefined),
  totalsNoData: z.number().optional().catch(undefined),
  totalsError: z.number().optional().catch(undefined),
  notificationType: z.enum(['SimplifiedRouting', 'NamedRoutingTree']).optional().catch(undefined),
  receiver: z.string().optional().catch(undefined),
  routingTree: z.string().optional().catch(undefined),
});
```

- [ ] **Step 4: Thread new fields through the `.transform()` at the bottom of `alertRuleSearchHit.ts`**

Find the `.transform(({ resource, fields }): AlertRuleSearchHit => ({...}))` block. Add the new fields:

```ts
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
    totalsHealthy: fields.totalsHealthy,
    totalsFiring: fields.totalsFiring,
    totalsPending: fields.totalsPending,
    totalsRecovering: fields.totalsRecovering,
    totalsNoData: fields.totalsNoData,
    totalsError: fields.totalsError,
    notificationType: fields.notificationType,
    receiver: fields.receiver,
    routingTree: fields.routingTree,
  })
);
```

- [ ] **Step 5: Run the existing hit schema tests to make sure nothing broke**

```bash
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchQuery.ts \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/alertRuleSearchHit.ts
git commit -m "feat(alerting): add instance count and routing fields to alert rule search hit"
```

---

## Task 2: `RuleInstanceCounts` component

A meta-strip item that shows per-state instance counts, all wrapped in one link to the rule's instances tab.

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.tsx`
- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { RuleInstanceCounts } from './RuleInstanceCounts';
import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', ...overrides };
}

describe('RuleInstanceCounts', () => {
  it('renders nothing when all totals fields are absent', () => {
    const { container } = render(<RuleInstanceCounts searchHit={baseHit()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only states with a non-zero count', () => {
    render(<RuleInstanceCounts searchHit={baseHit({ totalsFiring: 2, totalsPending: 1, totalsHealthy: 5 })} />);

    expect(screen.getByText('2 firing')).toBeInTheDocument();
    expect(screen.getByText('1 pending')).toBeInTheDocument();
    expect(screen.getByText('5 healthy')).toBeInTheDocument();
    expect(screen.queryByText(/recovering/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no data/)).not.toBeInTheDocument();
    expect(screen.queryByText(/error/)).not.toBeInTheDocument();
  });

  it('omits a state when its count is 0', () => {
    render(<RuleInstanceCounts searchHit={baseHit({ totalsFiring: 0, totalsHealthy: 3 })} />);

    expect(screen.queryByText(/firing/)).not.toBeInTheDocument();
    expect(screen.getByText('3 healthy')).toBeInTheDocument();
  });

  it('shows all six states when all are non-zero', () => {
    render(
      <RuleInstanceCounts
        searchHit={baseHit({
          totalsFiring: 1,
          totalsPending: 2,
          totalsHealthy: 3,
          totalsRecovering: 4,
          totalsNoData: 5,
          totalsError: 6,
        })}
      />
    );

    expect(screen.getByText('1 firing')).toBeInTheDocument();
    expect(screen.getByText('2 pending')).toBeInTheDocument();
    expect(screen.getByText('3 healthy')).toBeInTheDocument();
    expect(screen.getByText('4 recovering')).toBeInTheDocument();
    expect(screen.getByText('5 no data')).toBeInTheDocument();
    expect(screen.getByText('6 error')).toBeInTheDocument();
  });

  it('wraps the entire block in a single link to the instances tab', () => {
    render(<RuleInstanceCounts searchHit={baseHit({ totalsFiring: 2, totalsHealthy: 5 })} />);

    const link = screen.getByRole('link', { name: /instances/i });
    expect(link).toHaveAttribute('href', '/alerting/grafana/rule-1/view?tab=instances');
    // both badges must be inside that one link
    expect(link).toHaveTextContent('2 firing');
    expect(link).toHaveTextContent('5 healthy');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.test.tsx
```

Expected: FAIL — `RuleInstanceCounts` not found.

- [ ] **Step 3: Implement `RuleInstanceCounts`**

Create `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.tsx`:

```tsx
import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';

interface StateCount {
  count: number;
  label: string;
  colorKey: 'firing' | 'pending' | 'healthy' | 'recovering' | 'nodata' | 'error';
}

interface RuleInstanceCountsProps {
  searchHit: AlertRuleSearchHit;
}

export function RuleInstanceCounts({ searchHit }: RuleInstanceCountsProps) {
  const styles = useStyles2(getStyles);

  const states: StateCount[] = [
    {
      count: searchHit.totalsFiring ?? 0,
      label: t('alerting.gma-rule-list.instances.firing', 'firing'),
      colorKey: 'firing',
    },
    {
      count: searchHit.totalsPending ?? 0,
      label: t('alerting.gma-rule-list.instances.pending', 'pending'),
      colorKey: 'pending',
    },
    {
      count: searchHit.totalsRecovering ?? 0,
      label: t('alerting.gma-rule-list.instances.recovering', 'recovering'),
      colorKey: 'recovering',
    },
    {
      count: searchHit.totalsHealthy ?? 0,
      label: t('alerting.gma-rule-list.instances.healthy', 'healthy'),
      colorKey: 'healthy',
    },
    {
      count: searchHit.totalsNoData ?? 0,
      label: t('alerting.gma-rule-list.instances.nodata', 'no data'),
      colorKey: 'nodata',
    },
    {
      count: searchHit.totalsError ?? 0,
      label: t('alerting.gma-rule-list.instances.error', 'error'),
      colorKey: 'error',
    },
  ].filter(({ count, colorKey }) => {
    // Only include states explicitly present in the hit with a non-zero count.
    const fieldMap: Record<StateCount['colorKey'], keyof AlertRuleSearchHit> = {
      firing: 'totalsFiring',
      pending: 'totalsPending',
      recovering: 'totalsRecovering',
      healthy: 'totalsHealthy',
      nodata: 'totalsNoData',
      error: 'totalsError',
    };
    return searchHit[fieldMap[colorKey]] !== undefined && count > 0;
  });

  if (states.length === 0) {
    return null;
  }

  const href = grafanaRulesNav.viewLink(searchHit.uid) + '?tab=instances';
  const ariaLabel = t('alerting.gma-rule-list.instances.view-instances', 'View instances');

  return (
    <a href={href} aria-label={ariaLabel} className={styles.link}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="layers-alt" size="xs" className={styles.icon} />
        {states.map(({ count, label, colorKey }) => (
          <span key={colorKey} className={styles.badge[colorKey]}>
            {count} {label}
          </span>
        ))}
      </Stack>
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const badge = (color: string, bg: string) =>
    css({
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      padding: `1px ${theme.spacing(0.75)}`,
      borderRadius: theme.shape.radius.default,
      color,
      background: bg,
    });

  return {
    link: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      textDecoration: 'none',
      borderRadius: theme.shape.radius.default,
      padding: `1px ${theme.spacing(0.25)}`,
      '&:hover': { background: theme.colors.action.hover },
    }),
    icon: css({ color: theme.colors.text.secondary }),
    badge: {
      firing: badge(theme.colors.error.text, theme.colors.error.transparent),
      pending: badge(theme.colors.warning.text, theme.colors.warning.transparent),
      recovering: badge(theme.colors.info.text, theme.colors.info.transparent),
      healthy: badge(theme.colors.success.text, theme.colors.success.transparent),
      nodata: badge(theme.colors.text.secondary, theme.colors.background.secondary),
      error: badge(theme.colors.error.text, theme.colors.error.transparent),
    },
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.tsx \
        public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInstanceCounts.test.tsx
git commit -m "feat(alerting): add RuleInstanceCounts component"
```

---

## Task 3: `RuleRouting` component

A meta-strip item that shows where alert notifications are sent.

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.tsx`
- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.test.tsx`:

```tsx
import { render, screen } from 'test/test-utils';

import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';
import { RuleRouting } from './RuleRouting';

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', ...overrides };
}

describe('RuleRouting', () => {
  it('renders nothing when notificationType is absent', () => {
    const { container } = render(<RuleRouting searchHit={baseHit()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Delivered to {receiver}" with a contact-point link for SimplifiedRouting', () => {
    render(<RuleRouting searchHit={baseHit({ notificationType: 'SimplifiedRouting', receiver: 'pagerduty' })} />);

    expect(screen.getByText('Delivered to')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'pagerduty' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('pagerduty'));
  });

  it('shows "Policy: {name}" for NamedRoutingTree with a named policy', () => {
    render(
      <RuleRouting searchHit={baseHit({ notificationType: 'NamedRoutingTree', routingTree: 'infra-critical' })} />
    );

    expect(screen.getByText('Policy: infra-critical')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows "Default policy" for NamedRoutingTree without a routing tree name', () => {
    render(<RuleRouting searchHit={baseHit({ notificationType: 'NamedRoutingTree' })} />);

    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.test.tsx
```

Expected: FAIL — `RuleRouting` not found.

- [ ] **Step 3: Implement `RuleRouting`**

Create `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.tsx`:

```tsx
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, TextLink } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { createContactPointSearchLink } from '../../utils/misc';
import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';

interface RuleRoutingProps {
  searchHit: AlertRuleSearchHit;
}

export function RuleRouting({ searchHit }: RuleRoutingProps) {
  const { notificationType, receiver, routingTree } = searchHit;

  if (!notificationType) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Icon name="at" size="xs" />
      {notificationType === 'SimplifiedRouting' && receiver ? (
        <>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.gma-rule-list.routing.delivered-to">Delivered to</Trans>
          </Text>
          <TextLink
            variant="bodySmall"
            inline={false}
            href={createContactPointSearchLink(receiver, GRAFANA_RULES_SOURCE_NAME)}
          >
            {receiver}
          </TextLink>
        </>
      ) : routingTree ? (
        <Text variant="bodySmall" color="secondary">
          <Trans
            i18nKey="alerting.gma-rule-list.routing.policy"
            values={{ name: routingTree }}
            defaults="Policy: {{name}}"
          />
        </Text>
      ) : (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.gma-rule-list.routing.default-policy">Default policy</Trans>
        </Text>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.tsx \
        public/app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting.test.tsx
git commit -m "feat(alerting): add RuleRouting component"
```

---

## Task 4: Wire into `AlertRuleRow` and add row-level tests

Threads both new components into the row's `meta` array and verifies they appear correctly.

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx`

- [ ] **Step 1: Write the failing tests in `AlertRuleRow.test.tsx`**

Open the file. Add these cases inside the existing `describe('AlertRuleRow', ...)` block, after the existing tests:

```tsx
describe('instance counts', () => {
  it('shows firing and healthy counts in the meta strip', () => {
    renderRow({ searchHit: baseHit({ totalsFiring: 3, totalsHealthy: 7 }) });

    const link = screen.getByRole('link', { name: /instances/i });
    expect(link).toHaveAttribute('href', '/alerting/grafana/rule-1/view?tab=instances');
    expect(link).toHaveTextContent('3 firing');
    expect(link).toHaveTextContent('7 healthy');
  });

  it('shows no counts when all totals fields are absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByRole('link', { name: /instances/i })).not.toBeInTheDocument();
  });
});

describe('routing', () => {
  it('shows "Delivered to {receiver}" for simplified routing', () => {
    renderRow({
      searchHit: baseHit({ notificationType: 'SimplifiedRouting', receiver: 'pagerduty' }),
    });

    expect(screen.getByText('Delivered to')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'pagerduty' })).toBeInTheDocument();
  });

  it('shows "Policy: {name}" for a named routing tree', () => {
    renderRow({
      searchHit: baseHit({ notificationType: 'NamedRoutingTree', routingTree: 'infra-critical' }),
    });

    expect(screen.getByText('Policy: infra-critical')).toBeInTheDocument();
  });

  it('shows "Default policy" for a routing tree without a name', () => {
    renderRow({ searchHit: baseHit({ notificationType: 'NamedRoutingTree' }) });

    expect(screen.getByText('Default policy')).toBeInTheDocument();
  });

  it('shows no routing when notificationType is absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText('Delivered to')).not.toBeInTheDocument();
    expect(screen.queryByText(/Policy:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Default policy')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
```

Expected: the new cases FAIL (counts and routing not yet in the row).

- [ ] **Step 3: Wire both components into `AlertRuleRow.tsx`**

Open the file. Add the two new imports at the top:

```tsx
import { RuleInstanceCounts } from '../rule-row/RuleInstanceCounts';
import { RuleRouting } from '../rule-row/RuleRouting';
```

Then update the `meta` array inside `AlertRuleRow` (add the two new entries after `RuleLabels`):

```tsx
meta={[
  folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
  searchHit.datasourceUIDs && searchHit.datasourceUIDs.length > 0 && (
    <RuleDatasources key="ds" datasourceUIDs={searchHit.datasourceUIDs} />
  ),
  searchHit.labels && <RuleLabels key="labels" labels={searchHit.labels} />,
  <RuleInstanceCounts key="counts" searchHit={searchHit} />,
  <RuleRouting key="routing" searchHit={searchHit} />,
]}
```

Note: `RuleListItem` filters falsy entries from `meta`, but `RuleInstanceCounts` and `RuleRouting` return `null` themselves when there's nothing to show — so they can be passed unconditionally (no wrapper needed).

- [ ] **Step 4: Run all row tests to verify they pass**

```bash
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run the full gma-rule-list test suite**

```bash
yarn jest --no-watch public/app/features/alerting/unified/gma-rule-list/
```

Expected: all tests pass. Fix any regressions before committing.

- [ ] **Step 6: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
git commit -m "feat(alerting): wire instance counts and routing into AlertRuleRow"
```

---

## Task 5: TypeScript check and typecheck

Verify no type errors were introduced.

- [ ] **Step 1: Run the TypeScript compiler**

```bash
yarn typecheck 2>&1 | grep -E "gma-rule-list|RuleInstanceCounts|RuleRouting|alertRuleSearchHit|alertRuleSearchQuery"
```

Expected: no output (no errors in these files).

- [ ] **Step 2: Fix any type errors before continuing**

Common issues to watch for:

- `searchHit[fieldMap[colorKey]]` in `RuleInstanceCounts` — TypeScript may complain about indexing `AlertRuleSearchHit` with a computed key. If so, cast: `(searchHit as Record<string, unknown>)[fieldMap[colorKey]]`
- `Trans` with `defaults` prop — check `@grafana/i18n` API; if `defaults` isn't supported, use `t()` instead with `defaultValue`

- [ ] **Step 3: Commit any typecheck fixes**

```bash
git add -p
git commit -m "fix(alerting): resolve TypeScript errors in instance counts and routing"
```

---

## Task 6: Smoke test in the browser

Verify the feature looks right end-to-end with real data.

- [ ] **Step 1: Ensure both feature flags are on in `conf/custom.ini`**

```ini
[feature_toggles]
enable = alerting.gmaOnlyListView alerting.ruleStatusSync alerting.folderHasRulesLabel
```

- [ ] **Step 2: Start the backend and frontend**

In two separate terminals:

```bash
make run        # backend
pnpm start      # frontend
```

- [ ] **Step 3: Navigate to Alert rules and verify**

Open `http://localhost:3000/alerting/rules/alert`.

Check:

- In Folders view: expand a folder and confirm counts + routing appear in rule rows
- In List view: same check
- A rule with only healthy instances shows only "N healthy" (no other states)
- A rule with no totals shows no counts block at all
- Routing: find a rule with simplified routing and verify "Delivered to {name}" with a working link
- Routing: find a rule on the default policy and verify "Default policy" (no link)
