# Rule actions — PR 1: Alert rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Edit + More dropdown (View, Duplicate, Copy link, Pause/Resume, Delete, Analyze, Silence, Manage enrichments) to Alert rule rows, and New alert rule / Generate with AI / Design rule for provisioning to the page header.

**Architecture:** `AlertRuleListEntry` already fetches the full rule per row for the badge. It now also instantiates `<AlertRuleActions>` and passes it as an `actions` prop to `AlertRuleRow`, which renders it in the `right` slot alongside the interval. `AlertRuleRow` stays purely presentational. Permissions are read from `grafana.com/access/canWrite` and `grafana.com/access/canDelete` annotations on the full rule — no extra fetch.

**Tech Stack:** React, TypeScript, `@grafana/ui` (Dropdown, Menu, LinkButton), `@grafana/i18n`, MSW + React Testing Library for tests.

---

## File map

| File                                                                                       | Action                                       |
| ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `public/app/features/alerting/unified/gma-rule-list/rule-row/rulePermissions.ts`           | Create — `getRulePermissions` helper         |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.tsx`      | Create — Edit + More dropdown with all state |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.test.tsx` | Create                                       |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx`          | Modify — add `actions` prop                  |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx`     | Modify — add action cases                    |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.tsx`    | Modify — wire `<AlertRuleActions>`           |
| `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRulesPage.tsx`        | Modify — header actions                      |
| `public/app/features/alerting/unified/utils/navigation.ts`                                 | Modify — add `editLink` to `grafanaRulesNav` |

All paths are relative to the repo root `/Users/cbujanos/work/grafana`.

---

## Task 1: `getRulePermissions` helper

Reads access-control annotations from the full rule and detects provisioned/plugin/managed restrictions.

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/rule-row/rulePermissions.ts`

- [ ] **Step 1: Create the file**

```ts
import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export interface RulePermissions {
  canEdit: boolean;
  canPause: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  /** True while the full rule is still loading. All mutation actions are disabled. */
  isLoading: boolean;
}

type Rule = Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;

/**
 * Derives action permissions from the full rule's access-control annotations.
 * While loading (rule === undefined), all mutation actions are disabled.
 * After loading, provisioned, plugin-managed, and externally managed rules
 * have edit/pause/delete disabled regardless of annotations.
 */
export function getRulePermissions(rule: Rule | undefined): RulePermissions {
  if (rule === undefined) {
    return { canEdit: false, canPause: false, canDelete: false, canDuplicate: false, isLoading: true };
  }

  const canWrite = getAnnotation(rule, K8sAnnotations.AccessWrite) === 'true';
  const canDelete = getAnnotation(rule, K8sAnnotations.AccessDelete) === 'true';
  const isProvisioned = isK8sEntityProvisioned(rule);
  const isPlugin = !!getRulePluginOrigin({ labels: rule.spec?.labels });
  const isManaged = !!rule.metadata?.annotations?.['grafana.app/managedBy'];
  const restricted = isProvisioned || isPlugin || isManaged;

  return {
    canEdit: canWrite && !restricted,
    canPause: canWrite && !restricted,
    canDelete: canDelete && !restricted,
    canDuplicate: true,
    isLoading: false,
  };
}
```

- [ ] **Step 2: Run typecheck to confirm no errors**

```bash
pnpm typecheck 2>&1 | grep "rulePermissions"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/rule-row/rulePermissions.ts
git commit -m "feat(alerting): add getRulePermissions helper for GMA rule action gating"
```

---

## Task 2: Add `editLink` to `grafanaRulesNav`

The navigation util currently only has `viewLink`. Edit needs the same pattern.

**Files:**

- Modify: `public/app/features/alerting/unified/utils/navigation.ts`

- [ ] **Step 1: Read the file to find `grafanaRulesNav`**

Open `public/app/features/alerting/unified/utils/navigation.ts` and find:

```ts
export const grafanaRulesNav = {
  viewLink: (uid: string, options?: { includeReturnTo?: boolean }) => {
    const params: Record<string, string> = options?.includeReturnTo ? { returnTo: createReturnTo() } : {};
    return createRelativeUrl(`/alerting/grafana/${encodeURIComponent(uid)}/view`, params);
  },
};
```

- [ ] **Step 2: Add `editLink`**

```ts
export const grafanaRulesNav = {
  viewLink: (uid: string, options?: { includeReturnTo?: boolean }) => {
    const params: Record<string, string> = options?.includeReturnTo ? { returnTo: createReturnTo() } : {};
    return createRelativeUrl(`/alerting/grafana/${encodeURIComponent(uid)}/view`, params);
  },
  editLink: (uid: string) => createRelativeUrl(`/alerting/grafana/${encodeURIComponent(uid)}/edit`),
};
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "navigation"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add public/app/features/alerting/unified/utils/navigation.ts
git commit -m "feat(alerting): add editLink to grafanaRulesNav"
```

---

## Task 3: Add `actions` prop to `AlertRuleRow`

The row is purely presentational and renders whatever `actions` it receives in the `right` slot alongside the interval.

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx`

- [ ] **Step 1: Write a failing test**

Open `AlertRuleRow.test.tsx` and add inside the existing `describe('AlertRuleRow', ...)`:

```tsx
it('renders the actions slot in the right column', () => {
  renderRow({ searchHit: baseHit(), actions: <button>Custom action</button> });
  expect(screen.getByRole('button', { name: 'Custom action' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `actions` prop does not exist.

- [ ] **Step 3: Add `actions` prop to `AlertRuleRow`**

Open `AlertRuleRow.tsx`. Update the interface and the `right` slot:

```tsx
interface AlertRuleRowProps {
  searchHit: AlertRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
  /** Full rule resource; absent while loading or when the fetch failed. */
  rule?: AlertRule;
  /** Edit button and More dropdown; absent until wired. */
  actions?: ReactNode;
}
```

Add `ReactNode` to the React import:

```tsx
import { type ReactNode, useId } from 'react';
```

Update the `right` slot:

```tsx
right={
  (searchHit.interval || actions) && (
    <Stack alignItems="center" gap={0.5} wrap={false}>
      {searchHit.interval && <RuleInterval interval={searchHit.interval} />}
      {actions}
    </Stack>
  )
}
```

Remove the existing `right={searchHit.interval && <RuleInterval interval={searchHit.interval} />}` line and replace with the above.

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.tsx \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleRow.test.tsx
git commit -m "feat(alerting): add actions slot to AlertRuleRow"
```

---

## Task 4: `AlertRuleActions` component

The self-contained actions component with all state (drawers, confirm dialog, mutations).

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.tsx`
- Create: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.test.tsx`:

```tsx
import { render, screen, userEvent } from 'test/test-utils';

import { API_GROUP, API_VERSION, type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { K8sAnnotations } from '../../utils/k8s/constants';
import { setupMswServer } from '../../mockApi';
import { mockK8sAlertRule } from '../mocks/handlers';

import { AlertRuleActions } from './AlertRuleActions';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

setupMswServer();

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', ...overrides };
}

function ruleWithPerms({
  canWrite = true,
  canDelete = true,
  paused = false,
  isProvisioned = false,
}: {
  canWrite?: boolean;
  canDelete?: boolean;
  paused?: boolean;
  isProvisioned?: boolean;
} = {}): AlertRule {
  return {
    ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
    metadata: {
      name: 'rule-1',
      annotations: {
        [K8sAnnotations.AccessWrite]: String(canWrite),
        [K8sAnnotations.AccessDelete]: String(canDelete),
        ...(isProvisioned ? { [K8sAnnotations.Provenance]: 'terraform' } : {}),
      },
    },
    spec: {
      title: 'CPU high',
      expressions: {},
      execErrState: 'Error',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      paused,
    },
  };
}

describe('AlertRuleActions', () => {
  it('renders Edit and More buttons when canEdit is true', () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={ruleWithPerms()} />
      </ul>
    );
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('disables Edit and More while rule is loading', () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={undefined} />
      </ul>
    );
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled();
  });

  it('hides Edit when canEdit is false', () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={ruleWithPerms({ canWrite: false })} />
      </ul>
    );
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows Pause in More menu when canPause is true and rule is active', async () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={ruleWithPerms({ paused: false })} />
      </ul>
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Pause/i })).toBeInTheDocument();
  });

  it('shows Resume in More menu when rule is paused', async () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={ruleWithPerms({ paused: true })} />
      </ul>
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Resume/i })).toBeInTheDocument();
  });

  it('hides Pause/Delete from More menu when canPause/canDelete are false', async () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={ruleWithPerms({ canWrite: false, canDelete: false })} />
      </ul>
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('shows Delete confirmation dialog on Delete click', async () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={ruleWithPerms()} />
      </ul>
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete "CPU high"?');
  });

  it('hides Edit and Pause/Delete for provisioned rules', async () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={ruleWithPerms({ isProvisioned: true })} />
      </ul>
    );
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('always shows View, Duplicate and Copy link in More menu', async () => {
    render(
      <ul>
        <AlertRuleActions searchHit={baseHit()} rule={ruleWithPerms({ canWrite: false, canDelete: false })} />
      </ul>
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /View/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `AlertRuleActions` not found.

- [ ] **Step 3: Implement `AlertRuleActions`**

Create `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.tsx`:

```tsx
import { useState } from 'react';

import {
  type AlertRule,
  useDeleteAlertRuleMutation,
  useUpdateAlertRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { ConfirmModal, Dropdown, LinkButton, Menu, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { AppEvents } from '@grafana/data';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { EnrichmentDrawerExtension } from 'app/features/alerting/unified/components/rule-list/extensions/EnrichmentDrawerExtension';
import SilenceGrafanaRuleDrawer from 'app/features/alerting/unified/components/silences/SilenceGrafanaRuleDrawer';
import { RedirectToCloneRule } from 'app/features/alerting/unified/components/rules/CloneRule';
import { AnalyzeRuleButton } from 'app/features/alerting/unified/components/assistant/AnalizeRuleButton';
import { EnrichmentAction } from 'app/features/alerting/unified/hooks/abilities/types';
import { useEnrichmentAbility } from 'app/features/alerting/unified/hooks/abilities/otherAbilities';
import { isK8sEntityProvisioned } from 'app/features/alerting/unified/utils/k8s/utils';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { grafanaRulesNav } from '../../utils/navigation';
import { getRulePermissions } from '../rule-row/rulePermissions';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleActionsProps {
  searchHit: AlertRuleSearchHit;
  rule: AlertRule | undefined;
}

export function AlertRuleActions({ searchHit, rule }: AlertRuleActionsProps) {
  const { uid, title } = searchHit;
  const perms = getRulePermissions(rule);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);
  const [showEnrichmentDrawer, setShowEnrichmentDrawer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [redirectToClone, setRedirectToClone] = useState(false);

  const [deleteAlertRule] = useDeleteAlertRuleMutation();
  const [updateAlertRule, { isLoading: isPausing }] = useUpdateAlertRuleMutation();

  const { isAvailable: isAssistantAvailable } = useAssistant();
  const [enrichmentReadAbility] = useEnrichmentAbility(EnrichmentAction.Read);
  const canManageEnrichments =
    enrichmentReadAbility && config.featureToggles.alertEnrichment && config.featureToggles.alertingEnrichmentPerRule;

  const isPaused = rule?.spec?.paused ?? false;
  const isProvisioned = rule ? isK8sEntityProvisioned(rule) : false;

  const identifier: GrafanaRuleIdentifier = { ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid };

  const handlePauseResume = async () => {
    await updateAlertRule({ name: uid, patch: { spec: { paused: !isPaused } } });
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    await deleteAlertRule({ name: uid });
  };

  const handleCopyLink = async () => {
    const url = window.location.origin + grafanaRulesNav.viewLink(uid);
    try {
      await navigator.clipboard.writeText(url);
      appEvents.emit(AppEvents.alertSuccess, [t('alerting.gma-rule-list.actions.copy-link-success', 'Link copied')]);
    } catch {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.actions.copy-link-error', 'Failed to copy link'),
      ]);
    }
  };

  const menu = (
    <Menu>
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.view', 'View')}
        icon="eye"
        url={grafanaRulesNav.viewLink(uid)}
      />
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.duplicate', 'Duplicate')}
        icon="copy"
        onClick={() => setRedirectToClone(true)}
      />
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.copy-link', 'Copy link')}
        icon="link"
        onClick={handleCopyLink}
      />
      {perms.canPause && (
        <>
          <Menu.Divider />
          <Menu.Item
            label={
              isPaused
                ? t('alerting.gma-rule-list.actions.resume', 'Resume')
                : t('alerting.gma-rule-list.actions.pause', 'Pause')
            }
            icon={isPaused ? 'play' : 'pause'}
            onClick={handlePauseResume}
            disabled={isPausing}
          />
        </>
      )}
      {perms.canDelete && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.delete', 'Delete')}
          icon="trash-alt"
          destructive
          onClick={() => setShowDeleteConfirm(true)}
        />
      )}
      {(isAssistantAvailable || canManageEnrichments) && <Menu.Divider />}
      {isAssistantAvailable && rule && <AnalyzeRuleButton alertRule={rule} />}
      {canManageEnrichments && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.manage-enrichments', 'Manage enrichments')}
          icon="info-circle"
          onClick={() => setShowEnrichmentDrawer(true)}
        />
      )}
      <Menu.Divider />
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.silence', 'Silence notifications')}
        icon="bell-slash"
        onClick={() => setShowSilenceDrawer(true)}
      />
    </Menu>
  );

  return (
    <>
      {/* Show Edit while loading (disabled) or when the user has permission (enabled). Hidden after load if no permission. */}
      {(perms.canEdit || perms.isLoading) && (
        <LinkButton
          size="sm"
          variant="secondary"
          fill="text"
          href={perms.canEdit ? grafanaRulesNav.editLink(uid) : '#'}
          disabled={perms.isLoading}
          aria-disabled={perms.isLoading}
        >
          <Trans i18nKey="common.edit">Edit</Trans>
        </LinkButton>
      )}

      <Dropdown overlay={menu}>
        <MoreButton disabled={perms.isLoading} />
      </Dropdown>

      {showSilenceDrawer && <SilenceGrafanaRuleDrawer ruleUid={uid} onClose={() => setShowSilenceDrawer(false)} />}
      {showEnrichmentDrawer && <EnrichmentDrawerExtension ruleUid={uid} />}
      {showDeleteConfirm && (
        <ConfirmModal
          isOpen
          title={t('alerting.gma-rule-list.actions.delete-confirm-title', 'Delete alert rule')}
          body={t('alerting.gma-rule-list.actions.delete-confirm-body', 'Delete "{{title}}"?', {
            title,
            interpolation: { escapeValue: false },
          })}
          confirmText={t('alerting.gma-rule-list.actions.delete-confirm-button', 'Delete')}
          onConfirm={handleDelete}
          onDismiss={() => setShowDeleteConfirm(false)}
        />
      )}
      {redirectToClone && (
        <RedirectToCloneRule
          identifier={identifier}
          isProvisioned={isProvisioned}
          onDismiss={() => setRedirectToClone(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm jest --no-watch public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.test.tsx 2>&1 | tail -20
```

Expected: all tests pass. Fix any lint or type errors before continuing.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "AlertRuleActions"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.tsx \
        public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.test.tsx
git commit -m "feat(alerting): add AlertRuleActions component"
```

---

## Task 5: Wire `AlertRuleListEntry` to pass `actions`

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.tsx`

- [ ] **Step 1: Update `AlertRuleListEntry`**

Current file:

```tsx
import { useGetAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  searchHit: AlertRuleSearchHit;
  showFolderPath: boolean;
}

export function AlertRuleListEntry({ searchHit, showFolderPath }: AlertRuleListEntryProps) {
  const folderPath = useFolderPath(showFolderPath ? searchHit.folderUid : undefined);
  const { data: fullRule } = useGetAlertRuleQuery({ name: searchHit.uid });

  return <AlertRuleRow searchHit={searchHit} folderPath={folderPath} rule={fullRule} />;
}
```

Replace with:

```tsx
import { useGetAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';

import { AlertRuleActions } from './AlertRuleActions';
import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  searchHit: AlertRuleSearchHit;
  showFolderPath: boolean;
}

export function AlertRuleListEntry({ searchHit, showFolderPath }: AlertRuleListEntryProps) {
  const folderPath = useFolderPath(showFolderPath ? searchHit.folderUid : undefined);
  const { data: fullRule } = useGetAlertRuleQuery({ name: searchHit.uid });

  return (
    <AlertRuleRow
      searchHit={searchHit}
      folderPath={folderPath}
      rule={fullRule}
      actions={<AlertRuleActions searchHit={searchHit} rule={fullRule} />}
    />
  );
}
```

- [ ] **Step 2: Run the full gma-rule-list suite**

```bash
pnpm jest --no-watch public/app/features/alerting/unified/gma-rule-list/ 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleListEntry.tsx
git commit -m "feat(alerting): wire AlertRuleActions into AlertRuleListEntry"
```

---

## Task 6: Alert rules page header actions

Adds **New alert rule**, **Generate with AI**, and **More → Design rule for provisioning** to the page header.

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRulesPage.tsx`

- [ ] **Step 1: Read the current `AlertRulesPage.tsx`**

The file currently starts:

```tsx
import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { Box, EmptyState, Stack, useStyles2 } from '@grafana/ui';
import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
```

And the render:

```tsx
return (
  <AlertingPageWrapper navId="alert-rules">
    <Box paddingTop={2}>
```

- [ ] **Step 2: Implement header actions**

Add these imports at the top of the file (after existing imports):

```tsx
import { Trans, t } from '@grafana/i18n';
import { Dropdown, LinkButton, Menu } from '@grafana/ui';
import { config } from '@grafana/runtime';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
```

Add the `AlertRulesPageHeader` component at the bottom of the file (before `getStyles`):

```tsx
function AlertRulesPageHeader() {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const canCreate = createSupported && createAllowed;

  // Generate with AI is an enterprise-provided slot; it renders nothing when unregistered.
  const GenerateWithAI = config.featureToggles.alertingAIGeneration
    ? (
        require('app/features/alerting/unified/components/alert-rule-form/AIAlertRuleForm') as {
          GenerateAlertRuleButton?: React.ComponentType;
        }
      ).GenerateAlertRuleButton
    : undefined;

  const moreMenu = (
    <Menu>
      <Menu.Item
        label={t('alerting.gma-rule-list.header.design-for-provisioning', 'Design rule for provisioning')}
        icon="export"
        url="/alerting/new/grafana?view=provisioning"
      />
    </Menu>
  );

  return (
    <Stack direction="row" gap={1} alignItems="center">
      {GenerateWithAI && canCreate && <GenerateWithAI />}
      {canCreate && (
        <LinkButton href="/alerting/new/grafana" icon="plus" variant="primary">
          <Trans i18nKey="alerting.gma-rule-list.header.new-alert-rule">New alert rule</Trans>
        </LinkButton>
      )}
      <Dropdown overlay={moreMenu}>
        <MoreButton />
      </Dropdown>
    </Stack>
  );
}
```

Update `AlertRulesPage` to pass `actions` to `AlertingPageWrapper`:

```tsx
return (
  <AlertingPageWrapper navId="alert-rules" actions={<AlertRulesPageHeader />}>
```

> **Note:** The "Generate with AI" integration is enterprise-specific. Check with the team whether there's an existing registration pattern to use instead of the dynamic `require`. If so, use that pattern. The `Design rule for provisioning` URL may also need verification.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "AlertRulesPage"
```

Expected: no output. Fix any type errors before continuing.

- [ ] **Step 4: Run the full suite**

```bash
pnpm jest --no-watch public/app/features/alerting/unified/gma-rule-list/ 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRulesPage.tsx
git commit -m "feat(alerting): add header actions to AlertRulesPage"
```

---

## Task 7: TypeScript and lint pass

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck 2>&1 | grep -E "gma-rule-list|AlertRuleActions|rulePermissions|navigation"
```

Expected: no output.

- [ ] **Step 2: Run lint**

```bash
pnpm lint public/app/features/alerting/unified/gma-rule-list/alert-rules/AlertRuleActions.tsx \
          public/app/features/alerting/unified/gma-rule-list/rule-row/rulePermissions.ts 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Run the full gma-rule-list suite one final time**

```bash
pnpm jest --no-watch public/app/features/alerting/unified/gma-rule-list/ 2>&1 | tail -10
```

Expected: all tests pass.

---

## Task 8: Browser smoke test

- [ ] **Step 1: Verify feature flags in `conf/custom.ini`**

```ini
[feature_toggles]
enable = alerting.gmaOnlyListView alerting.ruleStatusSync alerting.folderHasRulesLabel
```

- [ ] **Step 2: Start backend and frontend**

In separate terminals:

```bash
make run
pnpm start
```

- [ ] **Step 3: Navigate to Alert rules and verify**

Open `http://localhost:3000/alerting/rules/alert`.

Check:

- Header shows **New alert rule** button (click it — opens rule creation form)
- Header shows **More** dropdown with **Design rule for provisioning**
- Rule rows show **Edit** link and **More** button
- Clicking **More** opens dropdown with View, Duplicate, Copy link, Pause, Delete
- Clicking **Delete** shows 'Delete "{title}"?' confirmation
- Confirming delete removes the row without navigating away
- **Pause** on a rule disables the Edit button and shows **Resume** next time
- For provisioned rules: Edit is absent, Pause and Delete are absent from More
