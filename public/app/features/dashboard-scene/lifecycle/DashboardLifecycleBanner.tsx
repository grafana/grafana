import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  useFlagAssistantDashboardDraftsAndPendingChanges,
  useFlagGrafanaVisualDesignRefresh,
} from '@grafana/runtime/internal';
import { Alert, Button, ConfirmModal, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { DashboardRoutes } from 'app/types/dashboard';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { type DashboardScene } from '../scene/DashboardScene';

import { CompareDrawer } from './CompareDrawer';
import { PublishModal } from './PublishModal';
import { daysUntilExpiry, getDashboardLifecycle } from './lifecycle';
import { discardDashboard, getSavedDashboard, type SavedDashboard } from './lifecycleApi';
import {
  clearPendingChangePreview,
  type DashboardPendingChanges,
  getPendingChangePreview,
  type PendingChangesView,
  setShowOriginal,
} from './pendingChangePreview';
import { useChangeHighlights } from './useChangeHighlights';
import { usePendingChangeDiff } from './usePendingChangeDiff';

interface Props {
  dashboard: DashboardScene;
  /** Where the banner renders: above a dashboard page, or inside an embedded dashboard view. */
  placement?: PendingChangesView;
  /**
   * Loads the dashboard again in this view after a draft is published or discarded, or
   * pending changes are switched, applied, or discarded. Defaults to the dashboard page.
   */
  reload?: () => Promise<void>;
}

/**
 * Shown on a draft (an unpublished dashboard), with Publish and Discard, and on a
 * dashboard opened with pending changes (see pendingChangePreview.ts): while previewing
 * them, with Compare, Apply, and Discard; while viewing the saved dashboard, with a way
 * back to the preview.
 */
export function DashboardLifecycleBanner({ dashboard, placement = 'page', reload }: Props) {
  const enabled = useFlagAssistantDashboardDraftsAndPendingChanges();
  const visualRefresh = useFlagGrafanaVisualDesignRefresh();
  // With the visual refresh, a dashboard page is a card inset from the page edge; line up with it.
  const inset: BannerInset = placement === 'page' ? (visualRefresh ? 'card' : 'page') : 'embedded';
  const { meta, uid, isEditing } = dashboard.useState();
  const info = useMemo(() => getDashboardLifecycle(dashboard), [dashboard, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled || !uid || isEditing) {
    return null;
  }
  const load = reload ?? (() => reloadDashboardPage(uid));
  if (info.lifecycle === 'draft') {
    return (
      <DraftBanner
        dashboard={dashboard}
        uid={uid}
        updatedAt={info.updatedAt}
        inset={inset}
        placement={placement}
        reload={load}
      />
    );
  }
  // The scene was loaded for this state (see pendingChangePreview.ts), so it is current.
  const preview = getPendingChangePreview(placement, uid);
  if (!preview) {
    return null;
  }
  return preview.previewing ? (
    <PendingChangesBanner
      key={dashboard.state.key}
      dashboard={dashboard}
      uid={uid}
      id={preview.id}
      pending={preview.pending}
      inset={inset}
      reload={load}
    />
  ) : (
    <PendingChangesHint uid={uid} id={preview.id} inset={inset} reload={load} />
  );
}

function reloadDashboardPage(uid: string) {
  return getDashboardScenePageStateManager().reloadDashboardFresh({ uid, route: DashboardRoutes.Normal });
}

function DraftBanner({
  dashboard,
  uid,
  updatedAt,
  inset,
  placement,
  reload,
}: {
  dashboard: DashboardScene;
  uid: string;
  updatedAt?: Date;
  inset: BannerInset;
  placement: PendingChangesView;
  reload: () => Promise<void>;
}) {
  const styles = useStyles2(getStyles, inset);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const days = daysUntilExpiry(updatedAt);

  return (
    <>
      <Alert className={styles.banner} severity="info" title={t('dashboard-scene.lifecycle.draft-title', 'Draft')}>
        <Stack justifyContent="space-between" alignItems="center" wrap="wrap" gap={2}>
          <span>
            {days === undefined ? (
              <Trans i18nKey="dashboard-scene.lifecycle.draft-body">Only you can see this dashboard.</Trans>
            ) : (
              t('dashboard-scene.lifecycle.draft-body-expiry', '', {
                count: days,
                defaultValue_one:
                  "Only you can see this dashboard. It moves to Recently deleted in {{count}} day if it isn't edited.",
                defaultValue_other:
                  "Only you can see this dashboard. It moves to Recently deleted in {{count}} days if it isn't edited.",
              })
            )}
          </span>
          <Stack gap={1}>
            <Button variant="destructive" fill="outline" size="sm" onClick={() => setDiscarding(true)}>
              <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setPublishing(true)}>
              <Trans i18nKey="dashboard-scene.lifecycle.publish">Publish</Trans>
            </Button>
          </Stack>
        </Stack>
      </Alert>
      {publishing && (
        <PublishModal
          uid={uid}
          title={dashboard.state.title}
          folderUid={dashboard.state.meta.folderUid}
          onDismiss={() => setPublishing(false)}
          onPublished={async () => {
            setPublishing(false);
            appEvents.emit(AppEvents.alertSuccess, [t('dashboard-scene.lifecycle.published', 'Dashboard published')]);
            getDashboardScenePageStateManager().removeSceneCache(uid);
            await reload();
          }}
        />
      )}
      {discarding && (
        <ConfirmModal
          isOpen
          title={t('dashboard-scene.lifecycle.discard-draft-title', 'Discard this draft?')}
          body={t(
            'dashboard-scene.lifecycle.discard-draft-body',
            'It moves to Recently deleted, where you can restore it for a while.'
          )}
          confirmText={t('dashboard-scene.lifecycle.discard', 'Discard')}
          onDismiss={() => setDiscarding(false)}
          onConfirm={async () => {
            await discardDashboard(uid);
            getDashboardScenePageStateManager().removeSceneCache(uid);
            setDiscarding(false);
            // The page leaves the discarded draft; an embedded view stays with its host.
            if (placement === 'page') {
              locationService.push('/dashboards');
            } else {
              await reload();
            }
          }}
        />
      )}
    </>
  );
}

interface PendingChangesProps {
  dashboard: DashboardScene;
  uid: string;
  id: string;
  pending: DashboardPendingChanges;
  inset: BannerInset;
  reload: () => Promise<void>;
}

/** While the scene shows the requester's pending changes: what they are, and Apply or Discard. */
function PendingChangesBanner({ dashboard, uid, id, pending, inset, reload }: PendingChangesProps) {
  const styles = useStyles2(getStyles, inset);
  const [saved, setSaved] = useState<SavedDashboard | null | undefined>(undefined);
  const [currentGeneration, setCurrentGeneration] = useState<number | undefined>(undefined);
  const [comparing, setComparing] = useState(false);
  const [confirm, setConfirm] = useState<'apply' | 'force' | 'discard' | undefined>(undefined);
  const [highlight, setHighlight] = useState(false);
  const { changes, baseSpec } = usePendingChangeDiff(uid, pending, saved);

  useEffect(() => {
    let cancelled = false;
    getSavedDashboard(uid)
      .then((dto) => !cancelled && setSaved(dto))
      .catch(() => !cancelled && setSaved(null));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useChangeHighlights(dashboard, highlight ? changes : undefined);

  const latestGeneration = currentGeneration ?? saved?.generation;
  const moved =
    latestGeneration !== undefined && latestGeneration !== pending.baseGeneration
      ? { baseGeneration: pending.baseGeneration, currentGeneration: latestGeneration }
      : undefined;
  const title = saved?.title ?? dashboard.state.title;
  const changeCount = changes?.length;
  const canApply = saved?.canEdit ?? false;

  const apply = useCallback(
    async (force: boolean) => {
      try {
        const result = await pending.apply({ force });
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
    },
    [pending, uid, id, title, reload]
  );

  return (
    <>
      <Alert
        className={styles.banner}
        severity={moved ? 'warning' : 'info'}
        title={
          moved
            ? t('dashboard-scene.lifecycle.pending-moved-title', '“{{title}}” changed since these changes were made', {
                title,
              })
            : t('dashboard-scene.lifecycle.pending-title', 'Previewing your pending changes')
        }
      >
        <Stack justifyContent="space-between" alignItems="center" wrap="wrap" gap={2}>
          <span>
            {moved
              ? t('dashboard-scene.lifecycle.pending-moved-body', '', {
                  count: moved.currentGeneration - moved.baseGeneration,
                  defaultValue_one:
                    'It has {{count}} newer version. Update your changes before you apply them, or overwrite it.',
                  defaultValue_other:
                    'It has {{count}} newer versions. Update your changes before you apply them, or overwrite it.',
                })
              : [
                  changeCount === undefined
                    ? undefined
                    : t('dashboard-scene.lifecycle.pending-changes', '', {
                        count: changeCount,
                        defaultValue_one: '{{count}} change',
                        defaultValue_other: '{{count}} changes',
                      }),
                  pending.source,
                  t('dashboard-scene.lifecycle.pending-private', 'only you can see them'),
                  saved && !canApply
                    ? t('dashboard-scene.lifecycle.pending-view-only', 'you can’t edit this dashboard')
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </span>
          <Stack gap={1} wrap="wrap">
            {!moved && changes && changes.length > 0 && (
              <Button
                variant="secondary"
                fill="outline"
                size="sm"
                icon={highlight ? 'eye-slash' : 'eye'}
                onClick={() => setHighlight((v) => !v)}
              >
                {highlight
                  ? t('dashboard-scene.lifecycle.hide-highlights', 'Hide changes')
                  : t('dashboard-scene.lifecycle.highlight', 'Highlight changes')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setComparing(true)}>
              <Trans i18nKey="dashboard-scene.lifecycle.compare">Compare</Trans>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setShowOriginal(uid, id, true);
                await reload();
              }}
            >
              <Trans i18nKey="dashboard-scene.lifecycle.show-original">Show original</Trans>
            </Button>
            {moved && pending.update && (
              <Button variant="primary" size="sm" onClick={() => pending.update?.()}>
                <Trans i18nKey="dashboard-scene.lifecycle.update-changes">Update changes</Trans>
              </Button>
            )}
            <Button variant="destructive" fill="outline" size="sm" onClick={() => setConfirm('discard')}>
              <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
            </Button>
            {canApply ? (
              moved ? (
                <Button variant="destructive" size="sm" onClick={() => setConfirm('force')}>
                  <Trans i18nKey="dashboard-scene.lifecycle.overwrite">Apply anyway</Trans>
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setConfirm('apply')} disabled={!saved}>
                  <Trans i18nKey="dashboard-scene.lifecycle.apply">Apply</Trans>
                </Button>
              )
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
          </Stack>
        </Stack>
      </Alert>
      {comparing && (
        <CompareDrawer
          title={title}
          proposedSpec={pending.proposed}
          baseSpec={baseSpec}
          latestSpec={saved?.spec}
          baseGeneration={pending.baseGeneration}
          onClose={() => setComparing(false)}
          onSelectPanel={(panelKey) => {
            setComparing(false);
            setHighlight(true);
            document
              .querySelector(`[data-viz-panel-key="${CSS.escape(panelKey)}"]`)
              ?.scrollIntoView({ block: 'center' });
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
            await apply(false);
          }}
        />
      )}
      {confirm === 'force' && moved && (
        <ConfirmModal
          isOpen
          title={t('dashboard-scene.lifecycle.overwrite-title', 'Overwrite “{{title}}”?', { title })}
          body={t('dashboard-scene.lifecycle.overwrite-body', '', {
            count: moved.currentGeneration - moved.baseGeneration,
            defaultValue_one:
              'Its {{count}} newer version is replaced by your changes. You can restore it from version history.',
            defaultValue_other:
              'Its {{count}} newer versions are replaced by your changes. You can restore them from version history.',
          })}
          confirmText={t('dashboard-scene.lifecycle.overwrite', 'Apply anyway')}
          onDismiss={() => setConfirm(undefined)}
          onConfirm={async () => {
            setConfirm(undefined);
            await apply(true);
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
            try {
              await pending.discard();
              clearPendingChangePreview(uid, id);
              await reload();
            } catch {
              appEvents.emit(AppEvents.alertError, [
                t('dashboard-scene.lifecycle.discard-pending-failed', "Couldn't discard the changes. Try again."),
              ]);
            }
          }}
        />
      )}
    </>
  );
}

/** While the requester looks at the saved dashboard: a quiet way back to their pending changes. */
function PendingChangesHint({
  uid,
  id,
  inset,
  reload,
}: {
  uid: string;
  id: string;
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
        onClick={async () => {
          setShowOriginal(uid, id, false);
          await reload();
        }}
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
