# Recording Rule Actions (PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add row actions (Edit, More: View/Duplicate/Copy link/Pause/Resume/Delete/Analyze) and a "New recording rule" page header to the GMA-only Recording Rules page.

**Architecture:** Mirrors PR 1's alert rule actions pattern exactly. Creates `RecordingRuleActions.tsx` for the row dropdown and `useRecordingRuleAbilities.ts` for per-rule permission state, then wires both into the existing `RecordingRuleRow` / `RecordingRuleListEntry` / `RecordingRulesPage` components. No Silence or Manage enrichments (those are alert-only).

**Tech Stack:** React, TypeScript, RTK Query (`useDeleteRecordingRuleMutation`, `useUpdateRecordingRuleMutation`), `@grafana/ui` Menu/Dropdown/LinkButton, MSW for tests.

---

## File Map

| File                                                            | Action     | Purpose                                                       |
| --------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| `gma-rule-list/recording-rules/useRecordingRuleAbilities.ts`    | **Create** | Per-rule ability hook: edit/pause/delete/duplicate            |
| `gma-rule-list/recording-rules/RecordingRuleActions.tsx`        | **Create** | Row actions: Edit button + More dropdown                      |
| `gma-rule-list/recording-rules/RecordingRuleActions.test.tsx`   | **Create** | Tests for RecordingRuleActions                                |
| `gma-rule-list/recording-rules/RecordingRuleRow.tsx`            | **Modify** | Accept `actions?: ReactNode` in right slot                    |
| `gma-rule-list/recording-rules/RecordingRuleRow.test.tsx`       | **Modify** | Test that actions slot renders                                |
| `gma-rule-list/recording-rules/RecordingRuleListEntry.tsx`      | **Modify** | Instantiate `<RecordingRuleActions>` and pass to row          |
| `gma-rule-list/recording-rules/RecordingRuleListEntry.test.tsx` | **Modify** | Smoke-test actions appear in entry                            |
| `gma-rule-list/recording-rules/RecordingRulesPage.tsx`          | **Modify** | Add `RecordingRulesPageHeader` with New recording rule button |
| `gma-rule-list/recording-rules/RecordingRulesPage.test.tsx`     | **Modify** | Test header button presence/absence by permission             |
| `public/locales/en-US/grafana.json`                             | **Modify** | Add i18n strings for new actions                              |

All paths are relative to `public/app/features/alerting/unified/`.

---

## Task 1: `useRecordingRuleAbilities` hook

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/recording-rules/useRecordingRuleAbilities.ts`

This is identical in shape to `useRuleAbilities.ts` (from PR 1) but drops `canSilence` and `canManageEnrichments`.

- [ ] **Step 1: Create the file**

```typescript
import { useMemo } from 'react';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type Ability, Granted, IsPluginManaged, NotSupported, Provisioned } from '../../hooks/abilities/types';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export interface RecordingRuleAbilities {
  canEdit: Ability;
  canPause: Ability;
  canDelete: Ability;
  canDuplicate: Ability;
}

type RuleMetadata = Pick<RecordingRule, 'metadata' | 'spec'>;

function writeAbility(isProvisioned: boolean, isPlugin: boolean, isManaged: boolean, canWrite: boolean): Ability {
  if (isProvisioned) {
    return Provisioned;
  }
  if (isPlugin) {
    return IsPluginManaged;
  }
  if (isManaged) {
    return NotSupported;
  }
  return canWrite ? Granted : NotSupported;
}

function duplicateAbility(isPlugin: boolean, canCreate: boolean): Ability {
  if (isPlugin) {
    return IsPluginManaged;
  }
  return canCreate ? Granted : NotSupported;
}

function deleteAbility(isProvisioned: boolean, isPlugin: boolean, isManaged: boolean, canDelete: boolean): Ability {
  if (isProvisioned) {
    return Provisioned;
  }
  if (isPlugin) {
    return IsPluginManaged;
  }
  if (isManaged) {
    return NotSupported;
  }
  return canDelete ? Granted : NotSupported;
}

function getRecordingRuleAbilities(rule: RuleMetadata, canCreate: boolean): RecordingRuleAbilities {
  const canWrite = getAnnotation(rule, K8sAnnotations.AccessWrite) === 'true';
  const canDelete = getAnnotation(rule, K8sAnnotations.AccessDelete) === 'true';
  const isProvisioned = isK8sEntityProvisioned(rule);
  const isPlugin = Boolean(getRulePluginOrigin({ labels: rule.spec?.labels }));
  const isManaged = Boolean(rule.metadata?.annotations?.['grafana.app/managedBy']);

  const write = writeAbility(isProvisioned, isPlugin, isManaged, canWrite);

  return {
    canEdit: write,
    canPause: write,
    canDelete: deleteAbility(isProvisioned, isPlugin, isManaged, canDelete),
    canDuplicate: duplicateAbility(isPlugin, canCreate),
  };
}

/** Returns action abilities for a GMA recording rule, memoized on the rule and permission state. */
export function useRecordingRuleAbilities(rule: RecordingRule): RecordingRuleAbilities {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const canCreate = createSupported && createAllowed;

  return useMemo(
    () => getRecordingRuleAbilities(rule, canCreate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rule.metadata?.annotations, rule.spec?.labels, canCreate]
  );
}
```

- [ ] **Step 2: Run typecheck to verify**

```bash
pnpm typecheck
```

Expected: 0 errors (the file uses only existing types).

- [ ] **Step 3: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/useRecordingRuleAbilities.ts
git commit -m "feat(alerting): add useRecordingRuleAbilities hook for GMA recording rules"
```

---

## Task 2: `RecordingRuleActions` component + tests

**Files:**

- Create: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleActions.tsx`
- Create: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleActions.test.tsx`

Mirrors `AlertRuleActions.tsx` exactly, minus Silence and Manage enrichments. Uses `useDeleteRecordingRuleMutation` and `useUpdateRecordingRuleMutation`.

- [ ] **Step 1: Write failing tests first**

Create `RecordingRuleActions.test.tsx`:

```typescript
import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import {
  API_GROUP,
  API_VERSION,
  type RecordingRule,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useAlertingAbility } from '../../hooks/useAbilities';
import { setupMswServer } from '../../mockApi';
import { K8sAnnotations } from '../../utils/k8s/constants';

jest.mock('../../hooks/useAbilities', () => ({
  ...jest.requireActual('../../hooks/useAbilities'),
  useAlertingAbility: jest.fn(),
}));
const mockUseAlertingAbility = jest.mocked(useAlertingAbility);

import { RecordingRuleActions } from './RecordingRuleActions';

const server = setupMswServer();

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
} = {}): RecordingRule {
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'RecordingRule',
    metadata: {
      name: 'rule-1',
      annotations: {
        [K8sAnnotations.AccessWrite]: String(canWrite),
        [K8sAnnotations.AccessDelete]: String(canDelete),
        ...(isProvisioned ? { [K8sAnnotations.Provenance]: 'terraform' } : {}),
      },
    },
    spec: {
      title: 'cpu:usage:rate5m',
      metric: 'cpu:usage:rate5m',
      targetDatasourceUID: 'gdev-prometheus',
      trigger: { interval: '1m' },
      expressions: {},
      paused,
    },
  };
}

function renderActions(rule: RecordingRule) {
  return render(
    <ul>
      <li>
        <RecordingRuleActions rule={rule} />
      </li>
    </ul>
  );
}

describe('RecordingRuleActions', () => {
  beforeEach(() => {
    mockUseAlertingAbility.mockReturnValue([true, true]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders Edit and More buttons when canEdit is true', () => {
    renderActions(ruleWithPerms());

    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('hides Edit when canEdit is false', () => {
    renderActions(ruleWithPerms({ canWrite: false }));

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('shows Pause when canPause is true and rule is active', async () => {
    renderActions(ruleWithPerms({ paused: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Pause/i })).toBeInTheDocument();
  });

  it('shows Resume when rule is paused', async () => {
    renderActions(ruleWithPerms({ paused: true }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Resume/i })).toBeInTheDocument();
  });

  it('hides Pause and Delete when user has no write/delete permission', async () => {
    renderActions(ruleWithPerms({ canWrite: false, canDelete: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('shows Delete confirmation dialog on Delete click', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete "cpu:usage:rate5m"?');
  });

  it('hides Edit and Pause/Delete for provisioned rules', async () => {
    renderActions(ruleWithPerms({ isProvisioned: true }));

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('always shows View and Copy link regardless of permissions', async () => {
    renderActions(ruleWithPerms({ canWrite: false, canDelete: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /View/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
  });

  it('shows Duplicate when user has create permission', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Duplicate/i })).toBeInTheDocument();
  });

  it('hides Duplicate when user lacks create permission', async () => {
    mockUseAlertingAbility.mockReturnValue([true, false]);
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('menuitem', { name: /View/i });
    expect(screen.queryByRole('menuitem', { name: /Duplicate/i })).not.toBeInTheDocument();
  });

  it('never shows Silence notifications (recording rules do not fire alerts)', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('menuitem', { name: /View/i });
    expect(screen.queryByRole('menuitem', { name: /Silence/i })).not.toBeInTheDocument();
  });

  it('calls DELETE after confirmation', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(
        `/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/recordingrules/:name`,
        () => {
          deleteCalled = true;
          return HttpResponse.json({}, { status: 200 });
        }
      )
    );

    renderActions(ruleWithPerms());
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Delete/i }));

    expect(deleteCalled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (component doesn't exist yet)**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/RecordingRuleActions"
```

Expected: FAIL — `Cannot find module './RecordingRuleActions'`

- [ ] **Step 3: Create `RecordingRuleActions.tsx`**

```typescript
import { useState } from 'react';

import {
  type RecordingRule,
  useDeleteRecordingRuleMutation,
  useUpdateRecordingRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, Dropdown, LinkButton, Menu, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { AnalyzeRuleButton } from 'app/features/alerting/unified/components/assistant/AnalizeRuleButton';
import { RedirectToCloneRule } from 'app/features/alerting/unified/components/rules/CloneRule';
import { isGranted } from 'app/features/alerting/unified/hooks/abilities/abilityUtils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { isK8sEntityProvisioned } from 'app/features/alerting/unified/utils/k8s/utils';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { grafanaRulesNav } from '../../utils/navigation';

import { useRecordingRuleAbilities } from './useRecordingRuleAbilities';

interface RecordingRuleActionsProps {
  rule: RecordingRule;
}

export function RecordingRuleActions({ rule }: RecordingRuleActionsProps) {
  const uid = rule.metadata.name ?? '';
  const title = rule.spec.title ?? '';
  const abilities = useRecordingRuleAbilities(rule);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [redirectToClone, setRedirectToClone] = useState(false);

  const [deleteRecordingRule] = useDeleteRecordingRuleMutation();
  const [updateRecordingRule, { isLoading: isPausing }] = useUpdateRecordingRuleMutation();

  const { isAvailable: isAssistantAvailable } = useAssistant();

  const isPaused = rule.spec?.paused ?? false;
  const isProvisioned = isK8sEntityProvisioned(rule);

  const identifier: GrafanaRuleIdentifier = { ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid };

  const handlePauseResume = async () => {
    const result = await updateRecordingRule({ name: uid, patch: { spec: { paused: !isPaused } } });
    if ('error' in result) {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.recording-rule-actions.pause-error', 'Failed to {{action}} rule', {
          action: isPaused
            ? t('alerting.gma-rule-list.recording-rule-actions.resume-action', 'resume')
            : t('alerting.gma-rule-list.recording-rule-actions.pause-action', 'pause'),
          interpolation: { escapeValue: false },
        }),
      ]);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    const result = await deleteRecordingRule({ name: uid });
    if ('error' in result) {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.recording-rule-actions.delete-error', 'Failed to delete rule'),
      ]);
    }
  };

  const handleCopyLink = async () => {
    const url = window.location.origin + grafanaRulesNav.viewLink(uid);
    try {
      await navigator.clipboard.writeText(url);
      appEvents.emit(AppEvents.alertSuccess, [
        t('alerting.gma-rule-list.recording-rule-actions.copy-link-success', 'Link copied'),
      ]);
    } catch {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.recording-rule-actions.copy-link-error', 'Failed to copy link'),
      ]);
    }
  };

  const menu = (
    <Menu>
      <Menu.Item
        label={t('alerting.gma-rule-list.recording-rule-actions.view', 'View')}
        icon="eye"
        url={grafanaRulesNav.viewLink(uid)}
      />
      {isGranted(abilities.canDuplicate) && (
        <Menu.Item
          label={t('alerting.gma-rule-list.recording-rule-actions.duplicate', 'Duplicate')}
          icon="copy"
          onClick={() => setRedirectToClone(true)}
        />
      )}
      <Menu.Item
        label={t('alerting.gma-rule-list.recording-rule-actions.copy-link', 'Copy link')}
        icon="link"
        onClick={handleCopyLink}
      />
      {isGranted(abilities.canPause) && (
        <>
          <Menu.Divider />
          <Menu.Item
            label={
              isPaused
                ? t('alerting.gma-rule-list.recording-rule-actions.resume', 'Resume')
                : t('alerting.gma-rule-list.recording-rule-actions.pause', 'Pause')
            }
            icon={isPaused ? 'play' : 'pause'}
            onClick={handlePauseResume}
            disabled={isPausing}
          />
        </>
      )}
      {isGranted(abilities.canDelete) && (
        <Menu.Item
          label={t('alerting.gma-rule-list.recording-rule-actions.delete', 'Delete')}
          icon="trash-alt"
          destructive
          onClick={() => setShowDeleteConfirm(true)}
        />
      )}
      {isAssistantAvailable && (
        <>
          <Menu.Divider />
          <AnalyzeRuleButton recordingRule={rule} />
        </>
      )}
    </Menu>
  );

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {isGranted(abilities.canEdit) && (
        <LinkButton size="sm" variant="secondary" fill="text" href={grafanaRulesNav.editLink(uid)}>
          <Trans i18nKey="common.edit">Edit</Trans>
        </LinkButton>
      )}

      <Dropdown overlay={menu}>
        <MoreButton />
      </Dropdown>

      {showDeleteConfirm && (
        <ConfirmModal
          isOpen
          title={t('alerting.gma-rule-list.recording-rule-actions.delete-confirm-title', 'Delete recording rule')}
          body={t('alerting.gma-rule-list.recording-rule-actions.delete-confirm-body', 'Delete "{{title}}"?', {
            title,
            interpolation: { escapeValue: false },
          })}
          confirmText={t('alerting.gma-rule-list.recording-rule-actions.delete-confirm-button', 'Delete')}
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
    </Stack>
  );
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/RecordingRuleActions"
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleActions.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleActions.test.tsx
git commit -m "feat(alerting): add RecordingRuleActions row actions component"
```

---

## Task 3: Wire actions into `RecordingRuleRow`

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx`

Add `actions?: ReactNode` prop and render it next to the interval in the `right` slot.

- [ ] **Step 1: Add failing test to `RecordingRuleRow.test.tsx`**

Open the file and add this test inside the existing `describe('RecordingRuleRow')` block, after the last existing test:

```typescript
it('renders actions in the right column when provided', () => {
  renderRow({ searchHit: baseHit(), actions: <button>More</button> });
  expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
});
```

Also ensure `renderRow` signature accepts `actions`. Check the existing `renderRow` helper — if it only accepts `Partial<RecordingRuleRowProps>` or takes `searchHit` only, update it to match after the prop is added in step 3.

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/RecordingRuleRow"
```

Expected: FAIL — `actions` is not an accepted prop.

- [ ] **Step 3: Update `RecordingRuleRow.tsx`**

Replace the import line and interface/function signature:

```diff
-import { useId } from 'react';
+import { type ReactNode, useId } from 'react';

 import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
-import { Stack, TextLink } from '@grafana/ui';
+import { Stack, TextLink } from '@grafana/ui';
```

Update the interface:

```typescript
interface RecordingRuleRowProps {
  searchHit: RecordingRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
  /** Full rule resource; absent while loading or when the fetch failed. */
  rule?: RecordingRule;
  /** Edit button, More dropdown, or a loading skeleton — provided by RecordingRuleListEntry. */
  actions?: ReactNode;
}
```

Update the function signature and `right` prop:

```typescript
export function RecordingRuleRow({ searchHit, folderPath, rule, actions }: RecordingRuleRowProps) {
```

```typescript
      right={
        (searchHit.interval || actions) && (
          <Stack alignItems="center" gap={1.5} wrap={false}>
            {searchHit.interval && <RuleInterval interval={searchHit.interval} />}
            {actions}
          </Stack>
        )
      }
```

- [ ] **Step 4: Run tests — should pass**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/RecordingRuleRow"
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx
git commit -m "feat(alerting): add actions slot to RecordingRuleRow right column"
```

---

## Task 4: Wire actions into `RecordingRuleListEntry`

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.test.tsx`

Pass `<RecordingRuleActions rule={fullRule} />` to the row when the full rule has loaded.

- [ ] **Step 1: Add failing test to `RecordingRuleListEntry.test.tsx`**

Add this test inside the existing `describe` block (requires `getRecordingRuleHandler` to return a rule with write permission, which the default handler returns a 404 — add an override):

```typescript
it('renders the More actions button when the full rule is available', async () => {
  server.use(
    getRecordingRuleHandler([
      {
        apiVersion: `${API_GROUP}/${API_VERSION}`,
        kind: 'RecordingRule',
        metadata: {
          name: 'rule-1',
          annotations: {
            'grafana.com/access/canWrite': 'true',
            'grafana.com/access/canDelete': 'true',
          },
        },
        spec: {
          title: 'cpu:usage:rate5m',
          metric: 'cpu:usage:rate5m',
          targetDatasourceUID: 'gdev-prometheus',
          trigger: { interval: '1m' },
          expressions: {},
        },
      },
    ])
  );

  render(
    <ul>
      <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m' }} showFolderPath={false} />
    </ul>
  );

  expect(await screen.findByRole('button', { name: 'More' })).toBeInTheDocument();
});
```

Also add `import { mockUseAlertingAbility }` pattern at the top — the abilities hook calls `useAlertingAbility` which needs mocking. Add these lines near the top of the test file (after imports):

```typescript
import { useAlertingAbility } from '../../hooks/useAbilities';

jest.mock('../../hooks/useAbilities', () => ({
  ...jest.requireActual('../../hooks/useAbilities'),
  useAlertingAbility: jest.fn(),
}));
const mockUseAlertingAbility = jest.mocked(useAlertingAbility);
```

And add a `beforeEach`:

```typescript
beforeEach(() => {
  mockUseAlertingAbility.mockReturnValue([true, true]);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/RecordingRuleListEntry"
```

Expected: FAIL — More button not found (actions not yet wired).

- [ ] **Step 3: Update `RecordingRuleListEntry.tsx`**

```typescript
import { useGetRecordingRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';

import { RecordingRuleActions } from './RecordingRuleActions';
import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  searchHit: RecordingRuleSearchHit;
  /** List mode only; Folders mode shows the folder on the folder row. */
  showFolderPath: boolean;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function RecordingRuleListEntry({ searchHit, showFolderPath }: RecordingRuleListEntryProps) {
  const folderPath = useFolderPath(showFolderPath ? searchHit.folderUid : undefined);
  const { data: fullRule } = useGetRecordingRuleQuery({ name: searchHit.uid });

  return (
    <RecordingRuleRow
      searchHit={searchHit}
      folderPath={folderPath}
      rule={fullRule}
      actions={fullRule && <RecordingRuleActions rule={fullRule} />}
    />
  );
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/RecordingRuleListEntry"
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.test.tsx
git commit -m "feat(alerting): wire RecordingRuleActions into RecordingRuleListEntry"
```

---

## Task 5: Add "New recording rule" page header

**Files:**

- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.tsx`
- Modify: `public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.test.tsx`

Add a `RecordingRulesPageHeader` component (like `AlertRulesPageHeader` in PR 1) with a single "New recording rule" `LinkButton`, shown only when the user has create permission.

- [ ] **Step 1: Write failing tests**

Add these tests to `RecordingRulesPage.test.tsx`. First check what mocking infra exists in that file — it likely uses `setupMswServer()` and may already mock `useAlertingAbility`. If not, add the same mock at the top:

```typescript
import { useAlertingAbility } from '../../hooks/useAbilities';

jest.mock('../../hooks/useAbilities', () => ({
  ...jest.requireActual('../../hooks/useAbilities'),
  useAlertingAbility: jest.fn(),
}));
const mockUseAlertingAbility = jest.mocked(useAlertingAbility);
```

Then add a `describe` block for the header:

```typescript
describe('RecordingRulesPage header', () => {
  it('shows New recording rule button when user has create permission', async () => {
    mockUseAlertingAbility.mockReturnValue([true, true]);
    render(<RecordingRulesPage />);

    expect(await screen.findByRole('link', { name: /New recording rule/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/alerting/new/grafana-recording')
    );
  });

  it('hides New recording rule button when user lacks create permission', async () => {
    mockUseAlertingAbility.mockReturnValue([true, false]);
    render(<RecordingRulesPage />);

    // Wait for page to settle
    await screen.findByRole('textbox');
    expect(screen.queryByRole('link', { name: /New recording rule/i })).not.toBeInTheDocument();
  });
});
```

Note: `render(<RecordingRulesPage />)` — check the existing tests to see how they import and render `RecordingRulesPage`. Use the same pattern (it may be a default export, so `import RecordingRulesPage from './RecordingRulesPage'`).

- [ ] **Step 2: Run failing tests**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/RecordingRulesPage\.test"
```

Expected: FAIL — New recording rule link not found.

- [ ] **Step 3: Add `RecordingRulesPageHeader` to `RecordingRulesPage.tsx`**

Add these imports at the top:

```typescript
import { Trans, t } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
```

Add the header component (after the `export default` line):

```typescript
function RecordingRulesPageHeader() {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const canCreate = createSupported && createAllowed;

  if (!canCreate) {
    return null;
  }

  return (
    <LinkButton href="/alerting/new/grafana-recording" icon="plus" variant="primary">
      <Trans i18nKey="alerting.gma-rule-list.recording-rules.header.new-rule">New recording rule</Trans>
    </LinkButton>
  );
}
```

Wire it into `AlertingPageWrapper`:

```typescript
// Change:
<AlertingPageWrapper navId="recording-rules">
// To:
<AlertingPageWrapper navId="recording-rules" actions={<RecordingRulesPageHeader />}>
```

- [ ] **Step 4: Run tests — all should pass**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/RecordingRulesPage\.test"
```

Expected: all pass including new header tests.

- [ ] **Step 5: Commit**

```bash
git add public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.tsx \
        public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.test.tsx
git commit -m "feat(alerting): add New recording rule header button to RecordingRulesPage"
```

---

## Task 6: Extract i18n strings

**Files:**

- Modify: `public/locales/en-US/grafana.json`

The strings in `RecordingRuleActions.tsx` use `t(...)` calls. The i18n extract command pulls them into the locale file.

- [ ] **Step 1: Run extraction**

```bash
make i18n-extract
```

- [ ] **Step 2: Verify strings were added**

```bash
grep "recording-rule-actions" public/locales/en-US/grafana.json
```

Expected: several lines for `alerting.gma-rule-list.recording-rule-actions.*` and one for `alerting.gma-rule-list.recording-rules.header.new-rule`.

- [ ] **Step 3: Commit**

```bash
git add public/locales/en-US/grafana.json
git commit -m "chore: extract i18n strings for recording rule actions"
```

---

## Task 7: Full suite verification

- [ ] **Step 1: Run all recording-rules tests**

```bash
pnpm exec jest --no-watch --testPathPattern="recording-rules/(RecordingRuleActions|RecordingRuleRow|RecordingRuleListEntry|RecordingRulesPage)"
```

Expected: all suites pass, 0 failures.

- [ ] **Step 2: Run prettier on all changed files**

```bash
pnpm prettier:write \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/useRecordingRuleAbilities.ts \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleActions.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleActions.test.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.test.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.test.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.test.tsx \
  public/locales/en-US/grafana.json
```

Expected: exit 0, no files changed (or only whitespace fixes).

- [ ] **Step 3: Run ESLint on changed source files**

```bash
pnpm lint -- \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/useRecordingRuleAbilities.ts \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleActions.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleRow.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRuleListEntry.tsx \
  public/app/features/alerting/unified/gma-rule-list/recording-rules/RecordingRulesPage.tsx
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Run TypeScript check**

```bash
pnpm typecheck
```

Expected: 0 errors.
