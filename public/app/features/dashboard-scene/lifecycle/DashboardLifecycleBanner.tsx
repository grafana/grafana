import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagAssistantDashboardArtifactsDraftsAndForks } from '@grafana/runtime/internal';
import { Alert, Button, ConfirmModal, Stack, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { type DashboardScene } from '../scene/DashboardScene';

import { CompareDrawer } from './CompareDrawer';
import { PublishModal } from './PublishModal';
import { daysUntilExpiry, getDashboardLifecycle } from './lifecycle';
import {
  discardDashboard,
  type ForkSummary,
  getDashboardDTO,
  listMyForksOf,
  mergeConflictFromError,
  mergeFork,
  type MergeConflict,
  type OriginalDashboard,
} from './lifecycleApi';
import { useChangeHighlights } from './useChangeHighlights';
import { useForkChanges } from './useForkChanges';

interface Props {
  dashboard: DashboardScene;
}

/**
 * Shown on a draft (an unpublished dashboard) or a fork (a working copy of a published
 * dashboard), with the actions that finish it: Publish, or Compare and Merge. On a
 * published dashboard it points at the viewer's own fork, if they have one.
 */
export function DashboardLifecycleBanner({ dashboard }: Props) {
  const enabled = useFlagAssistantDashboardArtifactsDraftsAndForks();
  const { meta, uid, isEditing } = dashboard.useState();
  const info = useMemo(() => getDashboardLifecycle(dashboard), [dashboard, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled || !uid || isEditing) {
    return null;
  }
  if (info.lifecycle === 'draft') {
    return <DraftBanner dashboard={dashboard} uid={uid} updatedAt={info.updatedAt} />;
  }
  if (info.lifecycle === 'fork' && info.forkOf) {
    return (
      <ForkBanner
        dashboard={dashboard}
        uid={uid}
        originalUid={info.forkOf}
        forkBase={info.forkBase}
        originRef={info.originRef}
        createdByAssistant={info.origin === 'assistant'}
      />
    );
  }
  // Keyed by the scene so a reload (for example after Grafana Assistant forks this dashboard) refetches.
  return <ForkHint key={dashboard.state.key} uid={uid} />;
}

function DraftBanner({ dashboard, uid, updatedAt }: { dashboard: DashboardScene; uid: string; updatedAt?: Date }) {
  const styles = useStyles2(getStyles);
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
            await getDashboardScenePageStateManager().reloadDashboard({});
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
            locationService.push('/dashboards');
          }}
        />
      )}
    </>
  );
}

interface ForkBannerProps {
  dashboard: DashboardScene;
  uid: string;
  originalUid: string;
  forkBase?: number;
  originRef?: string;
  createdByAssistant: boolean;
}

function ForkBanner({ dashboard, uid, originalUid, forkBase, originRef, createdByAssistant }: ForkBannerProps) {
  const styles = useStyles2(getStyles);
  const [original, setOriginal] = useState<OriginalDashboard | null | undefined>(undefined);
  const [conflict, setConflict] = useState<MergeConflict | undefined>(undefined);
  const [comparing, setComparing] = useState(false);
  const [confirm, setConfirm] = useState<'merge' | 'force' | 'discard' | undefined>(undefined);
  const [highlight, setHighlight] = useState(false);
  const { changes, baseSpec, latestSpec, forkSpec } = useForkChanges(uid, originalUid, forkBase, original);
  const { isAvailable: assistantAvailable, openAssistant } = useAssistant();

  useEffect(() => {
    let cancelled = false;
    getDashboardDTO(originalUid)
      .then((dto) => !cancelled && setOriginal(dto))
      .catch(() => !cancelled && setOriginal(null));
    return () => {
      cancelled = true;
    };
  }, [originalUid]);

  useChangeHighlights(dashboard, highlight ? changes : undefined);

  const moved =
    conflict ??
    (original && forkBase !== undefined && original.generation !== forkBase
      ? { baseGeneration: forkBase, currentGeneration: original.generation }
      : undefined);
  const originalTitle = original?.title ?? originalUid;
  const changeCount = changes?.length;

  const updateFork = useCallback(() => {
    if (!openAssistant) {
      return;
    }
    openAssistant({
      origin: 'dashboard/fork-banner',
      mode: 'dashboarding',
      prompt: `Update my fork of "${originalTitle}" (/dashboards/${uid}.dash) onto the latest version of the original: keep my changes and take everything else from the original, then mark the fork as updated.`,
      autoSend: true,
      chatId: chatIdFromOriginRef(originRef),
    });
  }, [openAssistant, originalTitle, uid, originRef]);

  const merge = useCallback(
    async (force: boolean) => {
      try {
        await mergeFork(uid, { force });
        getDashboardScenePageStateManager().removeSceneCache(originalUid);
        getDashboardScenePageStateManager().removeSceneCache(uid);
        appEvents.emit(AppEvents.alertSuccess, [
          t('dashboard-scene.lifecycle.merged', 'Merged into {{title}}', { title: originalTitle }),
        ]);
        locationService.push(original?.url ?? `/d/${originalUid}`);
      } catch (err) {
        const details = mergeConflictFromError(err);
        if (details) {
          setConflict(details);
          return;
        }
        appEvents.emit(AppEvents.alertError, [
          t('dashboard-scene.lifecycle.merge-failed', "Couldn't merge the fork. Try again, or compare it first."),
        ]);
      }
    },
    [uid, originalUid, originalTitle, original?.url]
  );

  if (original === null) {
    return (
      <Alert
        className={styles.banner}
        severity="warning"
        title={t('dashboard-scene.lifecycle.original-gone-title', 'The original dashboard is unavailable')}
      >
        <Stack justifyContent="space-between" alignItems="center" wrap="wrap" gap={2}>
          <Trans i18nKey="dashboard-scene.lifecycle.original-gone-body">
            It was deleted, or you no longer have access to it. You can still discard this fork.
          </Trans>
          <Button variant="destructive" fill="outline" size="sm" onClick={() => setConfirm('discard')}>
            <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
          </Button>
        </Stack>
        {confirm === 'discard' && (
          <DiscardForkModal uid={uid} originalUid={originalUid} onDismiss={() => setConfirm(undefined)} />
        )}
      </Alert>
    );
  }

  const canMerge = original?.canEdit ?? false;

  return (
    <>
      <Alert
        className={styles.banner}
        severity={moved ? 'warning' : 'info'}
        title={
          moved
            ? t('dashboard-scene.lifecycle.fork-moved-title', '“{{title}}” changed since you forked it', {
                title: originalTitle,
              })
            : t('dashboard-scene.lifecycle.fork-title', 'Fork of “{{title}}”', { title: originalTitle })
        }
      >
        <Stack justifyContent="space-between" alignItems="center" wrap="wrap" gap={2}>
          <span>
            {moved ? (
              t('dashboard-scene.lifecycle.fork-moved-body', '', {
                count: moved.currentGeneration - moved.baseGeneration,
                defaultValue_one:
                  'It has {{count}} newer version. Update the fork before you merge it, or overwrite the original.',
                defaultValue_other:
                  'It has {{count}} newer versions. Update the fork before you merge it, or overwrite the original.',
              })
            ) : (
              <>
                {changeCount === 0 && t('dashboard-scene.lifecycle.fork-no-changes', 'No changes yet')}
                {changeCount !== undefined &&
                  changeCount > 0 &&
                  t('dashboard-scene.lifecycle.fork-changes', '', {
                    count: changeCount,
                    defaultValue_one: '{{count}} change',
                    defaultValue_other: '{{count}} changes',
                  })}
                {' · '}
                {createdByAssistant
                  ? t('dashboard-scene.lifecycle.fork-by-assistant', 'created by Assistant for you')
                  : t('dashboard-scene.lifecycle.fork-private', 'only you can see it')}
                {!canMerge &&
                  original &&
                  ` · ${t('dashboard-scene.lifecycle.fork-view-only', 'you can view but not edit “{{title}}”', { title: originalTitle })}`}
                {' · '}
                <TextLink href={original?.url ?? `/d/${originalUid}`} inline>
                  {t('dashboard-scene.lifecycle.open-original', 'Open original')}
                </TextLink>
              </>
            )}
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
            {moved && assistantAvailable && openAssistant && (
              <Button variant="primary" size="sm" icon="ai-sparkle" onClick={updateFork}>
                <Trans i18nKey="dashboard-scene.lifecycle.update-fork">Update fork</Trans>
              </Button>
            )}
            <Button variant="destructive" fill="outline" size="sm" onClick={() => setConfirm('discard')}>
              <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
            </Button>
            {canMerge ? (
              moved ? (
                <Button variant="destructive" size="sm" onClick={() => setConfirm('force')}>
                  <Trans i18nKey="dashboard-scene.lifecycle.overwrite">Overwrite anyway</Trans>
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setConfirm('merge')} disabled={!original}>
                  <Trans i18nKey="dashboard-scene.lifecycle.merge">Merge</Trans>
                </Button>
              )
            ) : (
              original && (
                <Tooltip
                  content={t(
                    'dashboard-scene.lifecycle.ask-editor-tooltip',
                    'Merging needs edit access to “{{title}}”. Ask someone who can edit it to merge your changes.',
                    { title: originalTitle }
                  )}
                >
                  <Button variant="secondary" size="sm" icon="info-circle" fill="text">
                    <Trans i18nKey="dashboard-scene.lifecycle.ask-editor">Ask an editor to merge</Trans>
                  </Button>
                </Tooltip>
              )
            )}
          </Stack>
        </Stack>
      </Alert>
      {comparing && (
        <CompareDrawer
          title={originalTitle}
          forkSpec={forkSpec}
          baseSpec={baseSpec}
          latestSpec={latestSpec}
          baseGeneration={forkBase}
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
      {confirm === 'merge' && (
        <ConfirmModal
          isOpen
          title={t('dashboard-scene.lifecycle.merge-title', '', {
            count: changeCount ?? 0,
            title: originalTitle,
            defaultValue_one: 'Merge {{count}} change into “{{title}}”?',
            defaultValue_other: 'Merge {{count}} changes into “{{title}}”?',
          })}
          body={t(
            'dashboard-scene.lifecycle.merge-body',
            'Everyone with access will see them. You can restore the previous version from version history.'
          )}
          confirmText={t('dashboard-scene.lifecycle.merge', 'Merge')}
          confirmVariant="primary"
          onDismiss={() => setConfirm(undefined)}
          onConfirm={async () => {
            setConfirm(undefined);
            await merge(false);
          }}
        />
      )}
      {confirm === 'force' && moved && (
        <ConfirmModal
          isOpen
          title={t('dashboard-scene.lifecycle.overwrite-title', 'Overwrite “{{title}}”?', { title: originalTitle })}
          body={t('dashboard-scene.lifecycle.overwrite-body', '', {
            count: moved.currentGeneration - moved.baseGeneration,
            defaultValue_one:
              'The {{count}} newer version of the original is replaced by your fork. You can restore it from version history.',
            defaultValue_other:
              'The {{count}} newer versions of the original are replaced by your fork. You can restore them from version history.',
          })}
          confirmText={t('dashboard-scene.lifecycle.overwrite', 'Overwrite anyway')}
          onDismiss={() => setConfirm(undefined)}
          onConfirm={async () => {
            setConfirm(undefined);
            await merge(true);
          }}
        />
      )}
      {confirm === 'discard' && (
        <DiscardForkModal
          uid={uid}
          originalUid={originalUid}
          originalTitle={originalTitle}
          onDismiss={() => setConfirm(undefined)}
        />
      )}
    </>
  );
}

function DiscardForkModal({
  uid,
  originalUid,
  originalTitle,
  onDismiss,
}: {
  uid: string;
  originalUid: string;
  originalTitle?: string;
  onDismiss: () => void;
}) {
  return (
    <ConfirmModal
      isOpen
      title={t('dashboard-scene.lifecycle.discard-fork-title', 'Discard this fork?')}
      body={
        originalTitle
          ? t(
              'dashboard-scene.lifecycle.discard-fork-body',
              'It moves to Recently deleted. “{{title}}” isn’t affected.',
              {
                title: originalTitle,
              }
            )
          : t('dashboard-scene.lifecycle.discard-fork-body-generic', 'It moves to Recently deleted.')
      }
      confirmText={t('dashboard-scene.lifecycle.discard', 'Discard')}
      onDismiss={onDismiss}
      onConfirm={async () => {
        await discardDashboard(uid);
        getDashboardScenePageStateManager().removeSceneCache(uid);
        locationService.push(`/d/${originalUid}`);
      }}
    />
  );
}

/** On a published dashboard: a quiet pointer to the viewer's own fork of it. */
function ForkHint({ uid }: { uid: string }) {
  const styles = useStyles2(getStyles);
  const [forks, setForks] = useState<ForkSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    listMyForksOf(uid)
      .then((list) => !cancelled && setForks(list))
      .catch(() => !cancelled && setForks([]));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (forks.length === 0) {
    return null;
  }
  return (
    <div className={styles.hint} role="status">
      <span>
        {t('dashboard-scene.lifecycle.fork-hint', '', {
          count: forks.length,
          defaultValue_one: 'You have a fork of this dashboard',
          defaultValue_other: 'You have {{count}} forks of this dashboard',
        })}
      </span>
      <TextLink href={`/d/${forks[0].uid}`} inline>
        {t('dashboard-scene.lifecycle.open-fork', 'Open fork')}
      </TextLink>
    </div>
  );
}

/** Assistant chat links look like /a/grafana-assistant-app/.../<chat id>; the chat id is the last UUID. */
function chatIdFromOriginRef(originRef?: string): string | undefined {
  const match = originRef?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?!.*[0-9a-f]{8}-)/i);
  return match?.[0];
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    flex: 0,
    margin: theme.spacing(2, 2, 0, 2),
  }),
  hint: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    flex: 0,
    margin: theme.spacing(2, 2, 0, 2),
    padding: theme.spacing(0.75, 1.5),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
