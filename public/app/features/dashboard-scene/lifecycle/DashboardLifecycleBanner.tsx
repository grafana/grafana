import { css, cx } from '@emotion/css';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardDrafts, useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Alert, Button, ConfirmModal, Icon, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { DashboardRoutes } from 'app/types/dashboard';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { type DashboardScene } from '../scene/DashboardScene';

import { CompareDrawer } from './CompareDrawer';
import { PublishModal } from './PublishModal';
import { daysUntilExpiry, getDashboardLifecycle } from './lifecycle';
import { discardDashboard, getSavedDashboard, type SavedDashboard } from './lifecycleApi';
import { DashboardLifecycleChangedEvent } from './lifecycleEvents';
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
  const draftsEnabled = useFlagDashboardDrafts();
  const visualRefresh = useFlagGrafanaVisualDesignRefresh();
  // With the visual refresh, a dashboard page is a card inset from the page edge; line up with it.
  const inset: BannerInset = placement === 'page' ? (visualRefresh ? 'card' : 'page') : 'embedded';
  const { meta, uid, isEditing } = dashboard.useState();
  const info = useMemo(() => getDashboardLifecycle(dashboard), [dashboard, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!uid || isEditing) {
    return null;
  }
  const load = reload ?? (() => reloadDashboardPage(uid));
  if (info.lifecycle === 'draft') {
    if (!draftsEnabled) {
      return null;
    }
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
      <LifecycleAlert
        className={styles.banner}
        heading={t('dashboard-scene.lifecycle.draft-title', 'Draft')}
        actions={
          <>
            <Button variant="destructive" fill="outline" size="sm" onClick={() => setDiscarding(true)}>
              <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setPublishing(true)}>
              <Trans i18nKey="dashboard-scene.lifecycle.publish">Publish</Trans>
            </Button>
          </>
        }
      >
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
      </LifecycleAlert>
      {publishing && (
        <PublishModal
          uid={uid}
          title={dashboard.state.title}
          folderUid={dashboard.state.meta.folderUid}
          onDismiss={() => setPublishing(false)}
          onPublished={async () => {
            setPublishing(false);
            appEvents.emit(AppEvents.alertSuccess, [t('dashboard-scene.lifecycle.published', 'Dashboard published')]);
            appEvents.publish(new DashboardLifecycleChangedEvent({ uid, change: 'published' }));
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
            appEvents.publish(new DashboardLifecycleChangedEvent({ uid, change: 'discarded' }));
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

/**
 * While the scene shows the requester's pending changes: what they are, and Apply or Discard. Once
 * the dashboard moved on since they were made, Rebase or Discard instead.
 */
function PendingChangesBanner({ dashboard, uid, id, pending, inset, reload }: PendingChangesProps) {
  const styles = useStyles2(getStyles, inset);
  const [saved, setSaved] = useState<SavedDashboard | null | undefined>(undefined);
  const [currentGeneration, setCurrentGeneration] = useState<number | undefined>(undefined);
  const [comparing, setComparing] = useState(false);
  const [confirm, setConfirm] = useState<'apply' | 'discard' | undefined>(undefined);
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
  const stale = latestGeneration !== undefined && latestGeneration !== pending.baseGeneration;
  const title = saved?.title ?? dashboard.state.title;
  const changeCount = changes?.length;
  const canApply = saved?.canEdit ?? false;

  const apply = useCallback(async () => {
    try {
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
      <LifecycleAlert
        className={styles.banner}
        heading={t('dashboard-scene.lifecycle.pending-title', 'Pending changes')}
        headingAside={
          !stale &&
          changes &&
          changes.length > 0 && (
            <Button
              variant="secondary"
              fill={highlight ? 'solid' : 'outline'}
              size="sm"
              icon="eye"
              aria-pressed={highlight}
              onClick={() => setHighlight((v) => !v)}
            >
              <Trans i18nKey="dashboard-scene.lifecycle.highlight">Highlight</Trans>
            </Button>
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
          : t('dashboard-scene.lifecycle.pending-body', 'Previewing pending changes, only you can see them.')}{' '}
        <TextLink
          href={locationService.getLocation().pathname}
          onClick={async (event) => {
            event.preventDefault();
            setShowOriginal(uid, id, true);
            await reload();
          }}
        >
          {t('dashboard-scene.lifecycle.show-original-dashboard', 'Show original dashboard')}
        </TextLink>
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

interface LifecycleAlertProps {
  className: string;
  heading: string;
  /** Beside the heading, such as a toggle for what the banner describes. */
  headingAside?: ReactNode;
  /** At the top right. */
  actions: ReactNode;
  children: ReactNode;
}

/** An Alert with its actions beside the heading, at the top right, rather than centred beside the body. */
function LifecycleAlert({ className, heading, headingAside, actions, children }: LifecycleAlertProps) {
  const styles = useStyles2(getLifecycleAlertStyles);
  return (
    <Alert className={cx(className, styles.alert)} severity="info" title="" aria-label={heading}>
      <div className={styles.content}>
        <Stack justifyContent="space-between" alignItems="center" wrap="wrap" gap={1}>
          <Stack alignItems="center" gap={1}>
            <Text weight="medium">{heading}</Text>
            {headingAside}
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
    gap: theme.spacing(0.5),
  }),
});

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
  stale: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
  staleIcon: css({
    color: theme.colors.warning.text,
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
