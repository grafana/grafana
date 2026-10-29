import { css, cx } from '@emotion/css';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AppEvents, type GrafanaTheme2, locationUtil, urlUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import {
  Alert,
  Badge,
  Button,
  ConfirmModal,
  Icon,
  IconButton,
  LinkButton,
  Stack,
  Text,
  TextLink,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
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
  getPendingChangePreview,
  isHighlightingChanges,
  PENDING_CHANGES_QUERY_PARAM,
  type PendingChangesView,
  previewedDashboardUid,
  proposesNewDashboard,
  setHighlightingChanges,
  showOriginal,
} from './pendingChangePreview';
import { usePendingChangesHistoryState } from './pendingChangesHistory';
import { type SpecChange } from './specDiff';
import { dashboardViewRoot, panelSelector, queryDashboardView, useChangeHighlights } from './useChangeHighlights';
import { usePendingChangeDiff } from './usePendingChangeDiff';

interface Props {
  dashboard: DashboardScene;
  /** Where the banner renders: above a dashboard page, or inside an embedded dashboard view. */
  placement?: PendingChangesView;
  /**
   * Loads the dashboard again in this view after pending changes are switched, applied, or
   * discarded. Defaults to the dashboard page.
   */
  reload?: () => Promise<void>;
}

/**
 * Shown on a dashboard opened with pending changes (see pendingChangePreview.ts): while
 * previewing them, with Compare, Apply, and Discard; while viewing the saved dashboard, with a
 * way back to the preview. Pending changes that propose a new dashboard are a draft, with Save.
 */
export function DashboardLifecycleBanner({ dashboard, placement = 'page', reload }: Props) {
  const visualRefresh = useFlagGrafanaVisualDesignRefresh();
  // With the visual refresh, a dashboard page is a card inset from the page edge; line up with it.
  const inset: BannerInset = placement === 'page' ? (visualRefresh ? 'card' : 'page') : 'embedded';
  const { uid: sceneUid, meta, isEditing } = dashboard.useState();
  const uid = previewedDashboardUid({ uid: sceneUid, meta });

  if (!uid) {
    return null;
  }
  const load = reload ?? (() => reloadDashboardPage(uid));
  // The scene was loaded for this state (see pendingChangePreview.ts), so it is current.
  const preview = getPendingChangePreview(placement, uid);
  if (!preview) {
    return null;
  }
  // A draft stays in view while it is edited: its Save enters edit mode to open the save form.
  if (proposesNewDashboard(preview.pending)) {
    return (
      <NewDashboardBanner
        dashboard={dashboard}
        uid={uid}
        id={preview.id}
        pending={preview.pending}
        placement={placement}
        inset={inset}
        reload={load}
      />
    );
  }
  // Pending changes whose plugin keeps their history are edited under the banner, as a draft is.
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
      reload={load}
    />
  ) : (
    <PendingChangesHint uid={uid} id={preview.id} placement={placement} inset={inset} reload={load} />
  );
}

function reloadDashboardPage(uid: string) {
  return getDashboardScenePageStateManager().reloadDashboardFresh({ uid, route: DashboardRoutes.Normal });
}

interface PendingChangesProps {
  dashboard: DashboardScene;
  uid: string;
  id: string;
  pending: DashboardPendingChanges;
  placement: PendingChangesView;
  inset: BannerInset;
  reload: () => Promise<void>;
}

/**
 * While the scene shows the requester's pending changes: what they are, and Apply or Discard. Once
 * the dashboard moved on since they were made, Rebase or Discard instead.
 */
function PendingChangesBanner({ dashboard, uid, id, pending, placement, inset, reload }: PendingChangesProps) {
  const styles = useStyles2(getStyles, inset);
  const [saved, setSaved] = useState<SavedDashboard | null | undefined>(undefined);
  const [currentGeneration, setCurrentGeneration] = useState<number | undefined>(undefined);
  const [comparing, setComparing] = useState(false);
  const [confirm, setConfirm] = useState<'apply' | 'discard' | undefined>(undefined);
  // On unless the requester turns it off: badges the changed panels and dims the rest. Kept for the
  // tab, as the plugin's next change reloads the dashboard and this banner.
  const [highlighting, setHighlighting] = useState(() => isHighlightingChanges(uid, id));
  const toggleHighlighting = () => {
    setHighlightingChanges(uid, id, !highlighting);
    setHighlighting(!highlighting);
  };
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
  // Only on request, and against the version they were made from: once the dashboard moved on, they'd mislead.
  const badges = useChangeHighlights(dashboard, stale || !highlighting ? undefined : changes, viewRoot);
  const title = saved?.title ?? dashboard.state.title;
  const changeCount = changes?.length;
  const canApply = saved?.canEdit ?? false;

  const apply = useCallback(async () => {
    try {
      // This page saves the dashboard, through the plugin, and reloads itself after: the live
      // watcher's own reload for that save would race it and bring the applied changes back.
      dashboardWatcher.ignoreNextSave();
      const result = await pending.apply({ force: false });
      if (!result.applied) {
        setCurrentGeneration(result.currentGeneration);
        return;
      }
      clearPendingChangePreview(uid, id);
      appEvents.emit(AppEvents.alertSuccess, [
        t('dashboard-scene.lifecycle.applied', 'Applied your changes to {{title}}', { title }),
      ]);
      await reload();
    } catch {
      appEvents.emit(AppEvents.alertError, [
        t('dashboard-scene.lifecycle.apply-failed', "Couldn't apply the changes. Try again, or compare them first."),
      ]);
    }
  }, [pending, uid, id, title, reload]);

  const discard = (
    <Button variant="destructive" fill="outline" size="sm" onClick={() => setConfirm('discard')}>
      <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
    </Button>
  );

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
      <LifecycleAlert
        className={styles.banner}
        heading={t('dashboard-scene.lifecycle.pending-title', 'Pending changes')}
        headingAction={
          !stale && (
            <IconButton
              name={highlighting ? 'eye' : 'eye-slash'}
              size="sm"
              tooltip={
                highlighting
                  ? t('dashboard-scene.lifecycle.stop-highlighting-changes', 'Stop highlighting changes')
                  : t('dashboard-scene.lifecycle.highlight-changes', 'Highlight changes on the dashboard')
              }
              onClick={toggleHighlighting}
            />
          )
        }
        actions={
          stale ? (
            <>
              {discard}
              {pending.update && (
                <Button variant="primary" size="sm" onClick={() => pending.update?.()}>
                  <Trans i18nKey="dashboard-scene.lifecycle.rebase">Rebase</Trans>
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
                  <Trans i18nKey="dashboard-scene.lifecycle.apply">Apply</Trans>
                </Button>
              ) : (
                saved && (
                  <Tooltip
                    content={t(
                      'dashboard-scene.lifecycle.apply-needs-edit',
                      'Applying needs edit access to “{{title}}”. You can preview these changes, but not apply them.',
                      { title }
                    )}
                  >
                    <Button variant="primary" size="sm" disabled>
                      <Trans i18nKey="dashboard-scene.lifecycle.apply">Apply</Trans>
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
        <div className={styles.showOriginal}>
          <TextLink
            href={locationService.getLocation().pathname}
            onClick={async (event) => {
              event.preventDefault();
              await showOriginal(placement, uid, id, true, reload);
            }}
          >
            {t('dashboard-scene.lifecycle.show-original-dashboard', 'Show original dashboard')}
          </TextLink>
        </div>
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
          title={t('dashboard-scene.lifecycle.apply-title', '', {
            count: changeCount ?? 0,
            title,
            defaultValue_one: 'Apply {{count}} change to “{{title}}”?',
            defaultValue_other: 'Apply {{count}} changes to “{{title}}”?',
          })}
          body={t(
            'dashboard-scene.lifecycle.apply-body',
            'Everyone with access will see them. You can restore the previous version from version history.'
          )}
          confirmText={t('dashboard-scene.lifecycle.apply', 'Apply')}
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
              reload,
              t('dashboard-scene.lifecycle.discard-pending-failed', "Couldn't discard the changes. Try again.")
            );
          }}
        />
      )}
    </>
  );
}

interface NewDashboardProps extends PendingChangesProps {
  placement: PendingChangesView;
}

/**
 * While the scene shows a new dashboard proposed as pending changes: Save, through the dashboard's
 * own save form, which creates it under the uid it was proposed for, or Discard. The embedded view
 * can't save, so it links to the dashboard page instead.
 */
function NewDashboardBanner({ dashboard, uid, id, pending, placement, inset, reload }: NewDashboardProps) {
  const styles = useStyles2(getStyles, inset);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const save = () => {
    dashboard.onEnterEditMode();
    dashboard.openSaveDrawer({});
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
            {placement === 'page' ? (
              <Button variant="primary" size="sm" onClick={save}>
                <Trans i18nKey="dashboard-scene.lifecycle.save">Save</Trans>
              </Button>
            ) : (
              <LinkButton
                variant="primary"
                size="sm"
                href={locationUtil.assureBaseUrl(urlUtil.renderUrl(`/d/${uid}`, { [PENDING_CHANGES_QUERY_PARAM]: id }))}
              >
                <Trans i18nKey="dashboard-scene.lifecycle.open-to-save">Open to save</Trans>
              </LinkButton>
            )}
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
              placement === 'page' ? async () => locationService.push('/dashboards') : reload,
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
      <Button
        variant="secondary"
        fill="outline"
        size="sm"
        onClick={() => showOriginal(placement, uid, id, false, reload)}
      >
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
