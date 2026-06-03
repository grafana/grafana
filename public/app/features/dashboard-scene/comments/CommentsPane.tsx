import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Box, ScrollContainer, Sidebar, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

import { useComments } from './CommentsStore';
import { formatRelative, timestampHint } from './formatTime';
import { type User } from './types';

export class CommentsPane extends SceneObjectBase {
  public static Component = CommentsPaneRenderer;
  public getId() {
    return 'comments' as const;
  }
}

function CommentsPaneRenderer({ model }: SceneComponentProps<CommentsPane>) {
  const dashboard = getDashboardSceneFor(model);
  const { uid } = dashboard.useState();
  const { threads } = useComments(uid ?? '');
  const styles = useStyles2(getStyles);

  function openThread(id: number) {
    locationService.partial({ thread: String(id) });
  }

  return (
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader title={t('dashboard-scene.comments-pane.title', 'Comments')} />

      <div className={styles.threadsSectionHeader}>
        <span className={styles.sectionLabel}>
          <Trans i18nKey="dashboard-scene.comments-pane.threads">Threads</Trans>
        </span>
        <span className={styles.threadsCount}>{threads.length}</span>
      </div>

      <ScrollContainer showScrollIndicators={true}>
        <div className={styles.threadList}>
          {threads.length === 0 && (
            <div className={styles.empty}>
              <Trans i18nKey="dashboard-scene.comments-pane.empty">
                No comments yet. Click any panel to start a thread.
              </Trans>
            </div>
          )}
          {threads.map((thread, i) => {
            const firstMsg = thread.messages[0];
            const hint = timestampHint(thread.context.timeRange, thread.anchor.xNorm);
            return (
              <button
                key={thread.id}
                type="button"
                className={cx(styles.threadItem, thread.resolved && styles.threadItemResolved)}
                onClick={() => openThread(thread.id)}
              >
                <div className={styles.threadHeaderRow}>
                  <span className={styles.threadNumber}>#{i + 1}</span>
                  <span className={styles.threadTitle} title={thread.context.panelTitle}>
                    {thread.context.panelTitle || t('dashboard-scene.comments-pane.panel-fallback', 'Panel')}
                  </span>
                  {hint && <span className={styles.threadHint}>• {hint}</span>}
                </div>
                {firstMsg && (
                  <div className={styles.threadMetaRow}>
                    <UserAvatar user={firstMsg.author} className={styles.smallAvatar} />
                    <span className={styles.threadAuthor}>{firstMsg.author.name}</span>
                    <span className={styles.threadTime}>{formatRelative(firstMsg.createdAt)}</span>
                  </div>
                )}
                {firstMsg && <div className={styles.threadBody}>{firstMsg.body}</div>}
                {thread.messages.length > 1 && (
                  <div className={styles.threadReplies}>
                    <Trans
                      i18nKey="dashboard-scene.comments-pane.replies"
                      count={thread.messages.length - 1}
                    >
                      {'{{count}}'} replies
                    </Trans>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </ScrollContainer>
    </Box>
  );
}

function UserAvatar({ user, className }: { user: User; className: string }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className={className} />;
  }
  return (
    <span className={className} aria-label={user.name}>
      {user.name.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  sectionLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: theme.typography.fontWeightMedium,
  }),
  threadsSectionHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1.5, 0.5, 1.5),
  }),
  threadsCount: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  threadList: css({
    padding: theme.spacing(0.5, 1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  empty: css({
    padding: theme.spacing(2),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'center',
  }),
  threadItem: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    textAlign: 'left',
    color: theme.colors.text.primary,
    '&:hover': {
      borderColor: theme.colors.border.medium,
      background: theme.colors.background.canvas,
    },
  }),
  threadItemResolved: css({
    opacity: 0.55,
  }),
  threadHeaderRow: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  threadNumber: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    flexShrink: 0,
  }),
  threadTitle: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  threadHint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    flexShrink: 0,
  }),
  threadMetaRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  threadAuthor: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  threadTime: css({
    color: theme.colors.text.secondary,
  }),
  threadBody: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  threadReplies: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  smallAvatar: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: theme.colors.background.canvas,
    color: theme.colors.text.primary,
    fontSize: 10,
    fontWeight: theme.typography.fontWeightBold,
    flexShrink: 0,
    overflow: 'hidden',
    objectFit: 'cover',
  }),
});
