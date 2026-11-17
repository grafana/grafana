import { css, cx } from '@emotion/css';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Alert, Badge, Button, ConfirmModal, Icon, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DashboardRoutes } from 'app/types/dashboard';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { type DashboardScene } from '../scene/DashboardScene';

import { changeColor, changeLabel, CompareDrawer } from './CompareDrawer';
import { getSavedDashboard, type SavedDashboard } from './lifecycleApi';
import {
  clearPendingChangePreview,
  type DashboardPendingChanges,
  type DashboardLifecycleAction,
  getPendingChangePreview,
  type PendingChangePreview,
  type PendingChangesView,
  previewedDashboardUid,
  proposesNewDashboard,
  showOriginal,
} from './pendingChangePreview';
import {
  hasUnrecordedPendingChange,
  pendingChangesRecorded,
  pendingChangesSuperseded,
  recordPendingChange,
  usePendingChangesHistoryState,
} from './pendingChangesHistory';
import { closePendingChangesPage } from './pendingChangesPageReload';
import { diffDashboardSpecs, type SpecChange } from './specDiff';
import { dashboardViewRoot, panelSelector, queryDashboardView, useChangeHighlights } from './useChangeHighlights';
import { usePendingChangeDiff } from './usePendingChangeDiff';

/**
 * Save and Discard for pending changes or a draft an embedded dashboard view shows, for a host that
 * offers them itself instead of the view's banner.
 */
export interface DashboardViewLifecycleActions {
  /** Whether the view shows a draft, a new dashboard nobody saved yet, rather than pending changes. */
  draft: boolean;
  /** Opens the dashboard's save form. */
  save(): void;
  /** Asks to confirm, then discards them. */
  discard(): void;
}

interface Props {
  dashboard: DashboardScene;
  /** Where the banner renders: above a dashboard page, or inside an embedded dashboard view. */
  placement?: PendingChangesView;
  /**
   * Loads the dashboard again in this view after pending changes are switched, applied, or
   * discarded. Defaults to the dashboard page.
   */
  reload?: () => Promise<void>;
  onLifecycleChange?: (action: DashboardLifecycleAction) => void;
  onDiscardDraft?: () => void;
  /**
   * With it, an embedded view shows no banner: the host offers Save and Discard, which it is given
   * while the view shows pending changes or a draft, and undefined once it shows neither.
   */
  onLifecycleActions?: (actions: DashboardViewLifecycleActions | undefined) => void;
}

/**
 * What goes with a dashboard opened with pending changes (see pendingChangePreview.ts): a badge on
 * each panel they add or edit, and a banner wherever the dashboard's own Save can't save them. On
 * the page that is a preview it can't edit; editing, the toolbar saves or discards them. In an
 * embedded view the banner has Compare, Save and Discard, and a way to the saved dashboard and back.
 * Pending changes that propose a new dashboard are a draft, with Save.
 */
export function DashboardLifecycleBanner({
  dashboard,
  placement = 'page',
  reload,
  onLifecycleChange,
  onDiscardDraft,
  onLifecycleActions,
}: Props) {
  const { uid: sceneUid, meta } = dashboard.useState();
  const uid = previewedDashboardUid({ uid: sceneUid, meta });
  // The scene was loaded for this state (see pendingChangePreview.ts), so it is current.
  const preview = uid ? getPendingChangePreview(placement, uid) : undefined;
  const load = reload ?? (() => (uid ? reloadDashboardPage(uid) : Promise.resolve()));

  return (
    <>
      {preview?.previewing && !proposesNewDashboard(preview.pending) && (
        <PendingChangeBadges key={dashboard.state.key} dashboard={dashboard} preview={preview} />
      )}
      {onLifecycleActions ? (
        <HostLifecycleActions
          dashboard={dashboard}
          uid={uid}
          preview={preview}
          reload={load}
          onLifecycleChange={onLifecycleChange}
          onDiscardDraft={onDiscardDraft}
          onLifecycleActions={onLifecycleActions}
        />
      ) : (
        uid &&
        preview && (
          <LifecycleBanner
            dashboard={dashboard}
            uid={uid}
            preview={preview}
            placement={placement}
            reload={load}
            onLifecycleChange={onLifecycleChange}
            onDiscardDraft={onDiscardDraft}
          />
        )
      )}
    </>
  );
}

interface LifecycleBannerProps extends Omit<Props, 'reload' | 'placement' | 'onLifecycleActions'> {
  uid: string;
  preview: PendingChangePreview;
  placement: PendingChangesView;
  reload: () => Promise<void>;
}

function LifecycleBanner({
  dashboard,
  uid,
  preview,
  placement,
  reload,
  onLifecycleChange,
  onDiscardDraft,
}: LifecycleBannerProps) {
  const visualRefresh = useFlagGrafanaVisualDesignRefresh();
  // With the visual refresh, a dashboard page is a card inset from the page edge; line up with it.
  const inset: BannerInset = placement === 'page' ? (visualRefresh ? 'card' : 'page') : 'embedded';
  const { isEditing } = dashboard.useState();
  const close = placement === 'page' ? () => closePendingChangesPage(uid) : reload;
  // On the page, the toolbar saves or discards them while editing, and nothing links to the saved
  // dashboard instead of them any more.
  if (placement === 'page' && (isEditing || !preview.previewing)) {
    return null;
  }
  // A draft stays in view while it is edited in the embedded view: its Save enters edit mode to open
  // the save form.
  if (proposesNewDashboard(preview.pending)) {
    return (
      <NewDashboardBanner
        dashboard={dashboard}
        uid={uid}
        id={preview.id}
        pending={preview.pending}
        placement={placement}
        inset={inset}
        reload={reload}
        onLifecycleChange={onLifecycleChange}
        onDiscardDraft={onDiscardDraft}
      />
    );
  }
  // An edit session in the embedded view, for its save form, keeps the banner up only when the plugin
  // keeps the pending changes' history.
  if (isEditing && !preview.pending.history) {
    return null;
  }
  return preview.previewing ? (
    <PendingChangesBanner
      key={dashboard.state.key}
      dashboard={dashboard}
      uid={uid}
      id={preview.id}
      pending={preview.pending}
      placement={placement}
      inset={inset}
      reload={reload}
      close={close}
      onLifecycleChange={onLifecycleChange}
    />
  ) : (
    <PendingChangesHint uid={uid} id={preview.id} placement={placement} inset={inset} reload={reload} />
  );
}

function reloadDashboardPage(uid: string) {
  return getDashboardScenePageStateManager().reloadDashboardFresh({ uid, route: DashboardRoutes.Normal });
}

/**
 * A badge beside the title of each panel the pending changes add or edit, against the saved version
 * they would replace: what saving them would change. Once someone saved the dashboard since, that is
 * what saving over their save would change.
 */
function PendingChangeBadges({ dashboard, preview }: { dashboard: DashboardScene; preview: PendingChangePreview }) {
  // Edits on the page are recorded without a reload: the latest record is what the changes are.
  const recorded = usePendingChangesHistoryState(preview.pending.history).proposed;
  const proposed = recorded ?? preview.pending.proposed;
  const saved = preview.saved?.spec;
  const changes = useMemo(() => (saved ? diffDashboardSpecs(saved, proposed) : undefined), [saved, proposed]);
  // Finds this view's panels: the same dashboard can also be open in another view.
  const anchor = useRef<HTMLSpanElement>(null);
  const viewRoot = useCallback(() => dashboardViewRoot(anchor.current), []);
  const badges = useChangeHighlights(dashboard, changes, viewRoot);
  return (
    <>
      <span ref={anchor} hidden />
      {badges.map(({ change, mount }) =>
        createPortal(
          <Badge text={changeLabel(change)} color={changeColor(change)} tooltip={changeTooltip(change)} />,
          mount,
          change.panelKey
        )
      )}
    </>
  );
}

interface HostLifecycleActionsProps extends Omit<Props, 'reload' | 'placement'> {
  uid: string | undefined;
  preview: PendingChangePreview | undefined;
  reload: () => Promise<void>;
  onLifecycleActions: NonNullable<Props['onLifecycleActions']>;
}

/**
 * Hands an embedded view's host Save and Discard for the pending changes or draft the view shows. Save
 * opens the dashboard's save form in an edit session of its own, as the banner's Save does for a draft.
 */
function HostLifecycleActions({
  dashboard,
  uid,
  preview,
  reload,
  onLifecycleChange,
  onDiscardDraft,
  onLifecycleActions,
}: HostLifecycleActionsProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // The host's callbacks can change on each render; the actions it is given stay the same.
  const callbacks = useRef({ reload, onLifecycleChange, onDiscardDraft, onLifecycleActions });
  useEffect(() => {
    callbacks.current = { reload, onLifecycleChange, onDiscardDraft, onLifecycleActions };
  });
  const draft = preview ? proposesNewDashboard(preview.pending) : false;
  const shown = Boolean(uid && preview?.previewing);

  useEffect(() => {
    const report = callbacks.current.onLifecycleActions;
    if (!shown) {
      report(undefined);
      return;
    }
    report({
      draft,
      save: () => {
        dashboard.onEnterEditMode();
        dashboard.openSaveDrawer({
          onSaveSuccess: async () => {
            dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: false });
            if (draft) {
              callbacks.current.onLifecycleChange?.('saved');
              return;
            }
            await callbacks.current.reload();
            // The host may select another dashboard as soon as it receives this notification.
            callbacks.current.onLifecycleChange?.('applied');
          },
          onDismiss: () => dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: true }),
        });
      },
      discard: () => setConfirmDiscard(true),
    });
    return () => report(undefined);
  }, [dashboard, draft, shown]);

  if (!confirmDiscard || !uid || !preview) {
    return null;
  }
  return draft ? (
    <ConfirmModal
      isOpen
      title={t('dashboard-scene.lifecycle.discard-draft-title', 'Discard this draft?')}
      body={t('dashboard-scene.lifecycle.discard-draft-body', 'It was never saved, so nothing else changes.')}
      confirmText={t('dashboard-scene.lifecycle.discard', 'Discard')}
      onDismiss={() => setConfirmDiscard(false)}
      onConfirm={async () => {
        setConfirmDiscard(false);
        await discardPendingChanges(
          preview.pending,
          uid,
          preview.id,
          async () => {
            callbacks.current.onLifecycleChange?.('discarded');
            if (callbacks.current.onDiscardDraft) {
              callbacks.current.onDiscardDraft();
            } else {
              await callbacks.current.reload();
            }
          },
          t('dashboard-scene.lifecycle.discard-draft-failed', "Couldn't discard the draft. Try again.")
        );
      }}
    />
  ) : (
    <ConfirmModal
      isOpen
      title={t('dashboard-scene.lifecycle.discard-pending-title', 'Discard your pending changes?')}
      body={t('dashboard-scene.lifecycle.discard-pending-body', '“{{title}}” isn’t affected.', {
        title: dashboard.state.title,
      })}
      confirmText={t('dashboard-scene.lifecycle.discard', 'Discard')}
      onDismiss={() => setConfirmDiscard(false)}
      onConfirm={async () => {
        setConfirmDiscard(false);
        await discardPendingChanges(
          preview.pending,
          uid,
          preview.id,
          async () => {
            await callbacks.current.reload();
            callbacks.current.onLifecycleChange?.('discarded');
          },
          t('dashboard-scene.lifecycle.discard-pending-failed', "Couldn't discard the changes. Try again.")
        );
      }}
    />
  );
}

interface PendingChangesProps {
  dashboard: DashboardScene;
  uid: string;
  id: string;
  pending: DashboardPendingChanges;
  placement: PendingChangesView;
  inset: BannerInset;
  reload: () => Promise<void>;
  /** Shows the dashboard without the pending changes, once they are applied or discarded. */
  close: () => Promise<void>;
  onLifecycleChange?: Props['onLifecycleChange'];
}

/**
 * While the scene shows the requester's pending changes: what they are, and Apply or Discard. Once
 * the dashboard moved on since they were made, Rebase or Discard instead.
 */
function PendingChangesBanner({
  dashboard,
  uid,
  id,
  pending,
  placement,
  inset,
  reload,
  close,
  onLifecycleChange,
}: PendingChangesProps) {
  const styles = useStyles2(getStyles, inset);
  const [saved, setSaved] = useState<SavedDashboard | null | undefined>(undefined);
  const [currentGeneration, setCurrentGeneration] = useState<number | undefined>(undefined);
  const [comparing, setComparing] = useState(false);
  const [confirm, setConfirm] = useState<'apply' | 'discard' | undefined>(undefined);
  // Edits on the page are recorded without a reload: the latest record is what the changes are.
  const recorded = usePendingChangesHistoryState(pending.history).proposed;
  const proposed = recorded ?? pending.proposed;
  const { changes, baseSpec } = usePendingChangeDiff(uid, { baseGeneration: pending.baseGeneration, proposed }, saved);

  useEffect(() => {
    let cancelled = false;
    getSavedDashboard(uid)
      .then((dto) => !cancelled && setSaved(dto))
      .catch(() => !cancelled && setSaved(null));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const latestGeneration = currentGeneration ?? saved?.generation;
  const stale = latestGeneration !== undefined && latestGeneration !== pending.baseGeneration;
  // Finds this view's panels: the same dashboard can also be open in another view.
  const anchor = useRef<HTMLSpanElement>(null);
  const viewRoot = useCallback(() => dashboardViewRoot(anchor.current), []);
  const title = saved?.title ?? dashboard.state.title;
  const changeCount = changes?.length;
  // The API's canEdit is permission to save. The scene can still be editable without it: viewers_can_edit
  // lets a viewer change a dashboard they can't save.
  const canApply = saved?.canEdit ?? false;

  const apply = useCallback(async () => {
    // Apply saves what the plugin last recorded: an edit made here first has to be in it.
    await pendingChangesRecorded(dashboard);
    // Changed under an edit meanwhile: the page loads the newer pending changes for the user to review.
    if (pendingChangesSuperseded(dashboard)) {
      return;
    }
    if (pending.history && hasUnrecordedPendingChange(dashboard)) {
      await recordPendingChange(
        dashboard,
        pending.history,
        t('dashboard-scene.lifecycle.edited-dashboard', 'Edit dashboard')
      );
      if (hasUnrecordedPendingChange(dashboard) || pendingChangesSuperseded(dashboard)) {
        return;
      }
    }
    try {
      // This page saves the dashboard, through the plugin, and reloads itself after: the live
      // watcher's own reload for that save would race it and bring the applied changes back.
      dashboardWatcher.ignoreNextSave();
      const result = await pending.apply({ force: false });
      if (!result.applied) {
        // Nothing was saved: a save someone else makes now must still reload the page.
        dashboardWatcher.clearIgnoreSave();
        setCurrentGeneration(result.currentGeneration);
        return;
      }
      clearPendingChangePreview(uid, id);
      appEvents.emit(AppEvents.alertSuccess, [
        t('dashboard-scene.lifecycle.saved-pending', 'Saved your changes to {{title}}', { title }),
      ]);
      await close();
      // The host may select another dashboard as soon as it receives this notification.
      onLifecycleChange?.('applied');
    } catch {
      dashboardWatcher.clearIgnoreSave();
      appEvents.emit(AppEvents.alertError, [
        t(
          'dashboard-scene.lifecycle.save-pending-failed',
          "Couldn't save the changes. Try again, or compare them first."
        ),
      ]);
    }
  }, [dashboard, pending, uid, id, title, close, onLifecycleChange]);

  const discard = (
    <Button variant="destructive" fill="outline" size="sm" onClick={() => setConfirm('discard')}>
      <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
    </Button>
  );

  return (
    <>
      <span ref={anchor} hidden />
      <LifecycleAlert
        className={styles.banner}
        heading={t('dashboard-scene.lifecycle.pending-title', 'Pending changes')}
        actions={
          stale ? (
            <>
              {discard}
              {pending.update && (
                <Button variant="primary" size="sm" onClick={() => pending.update?.()}>
                  <Trans i18nKey="dashboard-scene.lifecycle.ask-assistant-to-update">Ask Assistant to update</Trans>
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setComparing(true)}>
                <Trans i18nKey="dashboard-scene.lifecycle.compare">Compare</Trans>
              </Button>
              {discard}
              {canApply ? (
                <Button variant="primary" size="sm" onClick={() => setConfirm('apply')} disabled={!saved}>
                  <Trans i18nKey="dashboard-scene.lifecycle.save">Save</Trans>
                </Button>
              ) : (
                saved && (
                  <Tooltip
                    content={t(
                      'dashboard-scene.lifecycle.save-needs-permission',
                      'You don’t have permission to save “{{title}}”, so you can preview these changes but not save them. Ask an admin for permission to save it.',
                      { title }
                    )}
                  >
                    <Button variant="primary" size="sm" disabled>
                      <Trans i18nKey="dashboard-scene.lifecycle.save">Save</Trans>
                    </Button>
                  </Tooltip>
                )
              )}
            </>
          )
        }
      >
        {pending.source
          ? t(
              'dashboard-scene.lifecycle.pending-body-source',
              'Previewing pending changes {{source}}, only you can see them.',
              {
                source: pending.source,
              }
            )
          : t('dashboard-scene.lifecycle.pending-body', 'Previewing pending changes, only you can see them.')}
        {placement === 'embedded' && (
          <div className={styles.showOriginal}>
            <TextLink
              href={locationService.getLocation().pathname}
              onClick={async (event) => {
                event.preventDefault();
                await showOriginal(uid, id, true, reload);
              }}
            >
              {t('dashboard-scene.lifecycle.show-original-dashboard', 'Show original dashboard')}
            </TextLink>
          </div>
        )}
        {stale && (
          <div className={styles.stale}>
            <Icon name="exclamation-triangle" className={styles.staleIcon} />
            <Trans i18nKey="dashboard-scene.lifecycle.pending-stale">
              Dashboard has been updated since your changes were made
            </Trans>
          </div>
        )}
      </LifecycleAlert>
      {comparing && (
        <CompareDrawer
          title={title}
          proposedSpec={proposed}
          baseSpec={baseSpec}
          latestSpec={saved?.spec}
          baseGeneration={pending.baseGeneration}
          onClose={() => setComparing(false)}
          onSelectPanel={(panelKey) => {
            setComparing(false);
            const root = viewRoot();
            const [panel] = root ? queryDashboardView(root, panelSelector(panelKey)) : [];
            panel?.scrollIntoView({ block: 'center' });
          }}
        />
      )}
      {confirm === 'apply' && (
        <ConfirmModal
          isOpen
          title={t('dashboard-scene.lifecycle.save-pending-title', '', {
            count: changeCount ?? 0,
            title,
            defaultValue_one: 'Save {{count}} change to “{{title}}”?',
            defaultValue_other: 'Save {{count}} changes to “{{title}}”?',
          })}
          body={t(
            'dashboard-scene.lifecycle.save-pending-body',
            'Everyone with access will see them. You can restore the previous version from version history.'
          )}
          confirmText={t('dashboard-scene.lifecycle.save', 'Save')}
          confirmVariant="primary"
          onDismiss={() => setConfirm(undefined)}
          onConfirm={async () => {
            setConfirm(undefined);
            await apply();
          }}
        />
      )}
      {confirm === 'discard' && (
        <ConfirmModal
          isOpen
          title={t('dashboard-scene.lifecycle.discard-pending-title', 'Discard your pending changes?')}
          body={t('dashboard-scene.lifecycle.discard-pending-body', '“{{title}}” isn’t affected.', { title })}
          confirmText={t('dashboard-scene.lifecycle.discard', 'Discard')}
          onDismiss={() => setConfirm(undefined)}
          onConfirm={async () => {
            setConfirm(undefined);
            await discardPendingChanges(
              pending,
              uid,
              id,
              async () => {
                await close();
                onLifecycleChange?.('discarded');
              },
              t('dashboard-scene.lifecycle.discard-pending-failed', "Couldn't discard the changes. Try again.")
            );
          }}
        />
      )}
    </>
  );
}

interface NewDashboardProps extends Omit<PendingChangesProps, 'close'> {
  placement: PendingChangesView;
  onDiscardDraft?: () => void;
}

/**
 * While the scene shows a new dashboard proposed as pending changes: Save, through the dashboard's
 * own save form, which creates it under the uid it was proposed for, or Discard.
 */
function NewDashboardBanner({
  dashboard,
  uid,
  id,
  pending,
  placement,
  inset,
  reload,
  onLifecycleChange,
  onDiscardDraft,
}: NewDashboardProps) {
  const styles = useStyles2(getStyles, inset);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const save = () => {
    dashboard.onEnterEditMode();
    dashboard.openSaveDrawer(
      placement === 'embedded'
        ? {
            onSaveSuccess: () => {
              dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: false });
              onLifecycleChange?.('saved');
            },
            onDismiss: () => dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: true }),
          }
        : {}
    );
  };

  return (
    <>
      <LifecycleAlert
        className={styles.banner}
        heading={t('dashboard-scene.lifecycle.draft-title', 'Draft')}
        actions={
          <>
            <Button variant="destructive" fill="outline" size="sm" onClick={() => setConfirmDiscard(true)}>
              <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
            </Button>
            <Button variant="primary" size="sm" onClick={save}>
              <Trans i18nKey="dashboard-scene.lifecycle.save">Save</Trans>
            </Button>
          </>
        }
      >
        {t(
          'dashboard-scene.lifecycle.draft-body',
          'Previewing a new dashboard, only you can see it until you save it.'
        )}
      </LifecycleAlert>
      {confirmDiscard && (
        <ConfirmModal
          isOpen
          title={t('dashboard-scene.lifecycle.discard-draft-title', 'Discard this draft?')}
          body={t('dashboard-scene.lifecycle.discard-draft-body', 'It was never saved, so nothing else changes.')}
          confirmText={t('dashboard-scene.lifecycle.discard', 'Discard')}
          onDismiss={() => setConfirmDiscard(false)}
          onConfirm={async () => {
            setConfirmDiscard(false);
            await discardPendingChanges(
              pending,
              uid,
              id,
              // Nothing is left to show on the page.
              async () => {
                onLifecycleChange?.('discarded');
                if (placement === 'page') {
                  locationService.push('/dashboards');
                } else if (onDiscardDraft) {
                  onDiscardDraft();
                } else {
                  await reload();
                }
              },
              t('dashboard-scene.lifecycle.discard-draft-failed', "Couldn't discard the draft. Try again.")
            );
          }}
        />
      )}
    </>
  );
}

/** Discards the pending changes and forgets them in every view, then shows what's left. */
async function discardPendingChanges(
  pending: DashboardPendingChanges,
  uid: string,
  id: string,
  afterwards: () => Promise<void>,
  failureMessage: string
) {
  try {
    await pending.discard();
    clearPendingChangePreview(uid, id);
    await afterwards();
  } catch {
    appEvents.emit(AppEvents.alertError, [failureMessage]);
  }
}

/** Which parts of an edited panel changed, on hover. A badge with nothing to add has no tooltip. */
function changeTooltip(change: SpecChange): string | undefined {
  return change.type === 'edited' && change.parts?.length
    ? t('dashboard-scene.lifecycle.change-badge-parts', 'Changed: {{parts}}', { parts: change.parts.join(', ') })
    : undefined;
}

interface LifecycleAlertProps {
  className: string;
  heading: string;
  /** Right after the heading, such as a toggle for how the dashboard shows the changes. */
  headingAction?: ReactNode;
  /** At the top right. */
  actions: ReactNode;
  children: ReactNode;
}

/** An Alert with its actions beside the heading, at the top right, rather than centred beside the body. */
function LifecycleAlert({ className, heading, headingAction, actions, children }: LifecycleAlertProps) {
  const styles = useStyles2(getLifecycleAlertStyles);
  return (
    <Alert className={cx(className, styles.alert)} severity="info" title="" aria-label={heading}>
      <div className={styles.content}>
        <Stack justifyContent="space-between" alignItems="center" wrap="wrap" gap={1}>
          <Stack alignItems="center" gap={1.5}>
            <Text weight="medium">{heading}</Text>
            {headingAction}
          </Stack>
          <Stack gap={1} wrap="wrap">
            {actions}
          </Stack>
        </Stack>
        <div>{children}</div>
      </div>
    </Alert>
  );
}

const getLifecycleAlertStyles = (theme: GrafanaTheme2) => ({
  alert: css({
    // Alert renders its action area even when empty, and the empty area still takes a gap on the right.
    '& [data-testid] > div > div:empty': {
      display: 'none',
    },
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
});

/** While the requester looks at the saved dashboard: a quiet way back to their pending changes. */
function PendingChangesHint({
  uid,
  id,
  placement,
  inset,
  reload,
}: {
  uid: string;
  id: string;
  placement: PendingChangesView;
  inset: BannerInset;
  reload: () => Promise<void>;
}) {
  const styles = useStyles2(getStyles, inset);
  return (
    <div className={styles.hint} role="status">
      <span>
        <Trans i18nKey="dashboard-scene.lifecycle.pending-hint">
          You’re viewing the saved dashboard. It has pending changes that only you can see.
        </Trans>
      </span>
      <Button variant="secondary" fill="outline" size="sm" onClick={() => showOriginal(uid, id, false, reload)}>
        <Trans i18nKey="dashboard-scene.lifecycle.preview-changes">Preview changes</Trans>
      </Button>
    </div>
  );
}

/**
 * card: a visual-refresh dashboard page, whose dashboard card is inset 0.5 from the page edge.
 * page: a classic dashboard page, whose panels are inset 2.
 * embedded: an embedded dashboard view, whose controls already pad the gap below.
 */
type BannerInset = 'card' | 'page' | 'embedded';

function bannerMargin(theme: GrafanaTheme2, inset: BannerInset): string {
  switch (inset) {
    case 'card':
      return theme.spacing(2, 0.5);
    case 'page':
      return theme.spacing(2, 2);
    case 'embedded':
      return theme.spacing(2, 2, 0, 2);
  }
}

const getStyles = (theme: GrafanaTheme2, inset: BannerInset) => ({
  banner: css({
    flex: 0,
    margin: bannerMargin(theme, inset),
  }),
  stale: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
  staleIcon: css({
    color: theme.colors.warning.text,
  }),
  showOriginal: css({
    marginTop: theme.spacing(1),
  }),
  hint: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    flex: 0,
    margin: bannerMargin(theme, inset),
    padding: theme.spacing(0.75, 1.5),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
