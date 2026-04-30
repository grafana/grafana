import { css } from '@emotion/css';
import { type ReactNode, useEffect, useState } from 'react';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Avatar, Box, Button, Card, EmptyState, Icon, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';

import {
  useCreateThreadMutation,
  useGetResourceVersionQuery,
  useGetThreadQuery,
  useListThreadsQuery,
} from '../api/pulseApi';
import { useResourcePulseStream } from '../hooks/useResourcePulseStream';
import { type PulseThread } from '../types';
import { bodyToText } from '../utils/body';
import { type PanelSuggestion } from '../utils/lookups';

import { PulseComposer } from './PulseComposer';
import { PulseRenderer } from './PulseRenderer';
import { PulseThreadView } from './PulseThreadView';

interface Props {
  resourceUID: string;
  panelId?: number;
  panels?: PanelSuggestion[];
  currentUserId?: number;
  isAdmin?: boolean;
  onMentionPanel?: (panelId: number) => void;
  /** When set, the drawer auto-opens this thread on mount (deep link from
   *  the global Pulse overview). Cleared via onInitialThreadOpened so a
   *  subsequent "Back" doesn't snap back to the deep-linked thread. */
  initialThreadUID?: string;
  onInitialThreadOpened?: () => void;
}

// Page size for the threads list. The backend caps at 100 and defaults
// to 50; we render in narrow drawer space so 10 keeps each card legible
// and the user comfortably reaches the bottom without scroll fatigue.
const THREADS_PAGE_SIZE = 10;

/**
 * PulseDrawerContent is the inside of the Pulse drawer, scoped to a
 * specific dashboard (with optional panel filter). The component is
 * pure: the SceneObject wrapper handles overlay/url-state plumbing.
 *
 * State machine:
 *   list view ──"start"──> compose new thread ──"send"──> thread view
 *   list view ──click thread──> thread view
 *   thread view ──"back"──> list view
 */
export function PulseDrawerContent({
  resourceUID,
  panelId,
  panels,
  currentUserId,
  isAdmin = false,
  onMentionPanel,
  initialThreadUID,
  onInitialThreadOpened,
}: Props): ReactNode {
  const styles = useStyles2(getStyles);
  const [activeThreadUID, setActiveThreadUID] = useState<string | null>(initialThreadUID ?? null);
  const [composing, setComposing] = useState(false);

  // Adopt a deep-linked thread UID once, then collapse the URL back to
  // the plain "open" form. Repeated mounts without a new URL won't
  // re-trigger the open because the SceneObject clears its own state
  // when onInitialThreadOpened fires.
  useEffect(() => {
    if (!initialThreadUID) {
      return;
    }
    setActiveThreadUID(initialThreadUID);
    onInitialThreadOpened?.();
  }, [initialThreadUID, onInitialThreadOpened]);
  // cursorStack records the cursor used to load each visited page. Page 0
  // is the empty list (no cursor); pushing the server's nextCursor onto
  // the stack opens the next page; popping returns to the previous one.
  // We avoid storing the data itself — RTK Query caches every (cursor,
  // limit) tuple separately, so going back to a prior page is a cache
  // hit rather than a refetch.
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const currentCursor = cursorStack[cursorStack.length - 1];

  // When the user navigates to a different resource (e.g. switches
  // dashboards while the drawer is open) the cursor we're holding is
  // meaningless on the new resource — reset to the first page so the
  // list always opens on what's most recent.
  useEffect(() => {
    setCursorStack([]);
  }, [resourceUID, panelId]);

  // Polling fallback when Live is unavailable. Refetches every 15s; live
  // events will invalidate sooner. RTK dedupes within the cache.
  useGetResourceVersionQuery(
    { resourceKind: 'dashboard', resourceUID },
    { pollingInterval: 15_000, skip: !resourceUID }
  );

  useResourcePulseStream({ resourceKind: 'dashboard', resourceUID, enabled: !!resourceUID });

  const { data, isLoading, isFetching } = useListThreadsQuery({
    resourceKind: 'dashboard',
    resourceUID,
    panelId,
    limit: THREADS_PAGE_SIZE,
    cursor: currentCursor,
  });

  const [createThread, createThreadState] = useCreateThreadMutation();

  // When the user opens a thread that isn't on the current page (e.g.
  // a deep link from the global overview), fall back to fetching the
  // thread by UID. The hook is skipped when the active thread is
  // already in the list — RTK dedupes either way but skipping cuts a
  // network round-trip.
  const threadFromList = activeThreadUID ? data?.items.find((t) => t.uid === activeThreadUID) : undefined;
  const { data: directThread, isLoading: isLoadingDirect } = useGetThreadQuery(activeThreadUID ?? '', {
    skip: !activeThreadUID || !!threadFromList,
  });
  const activeThread = threadFromList ?? directThread;

  if (activeThreadUID) {
    if (!activeThread) {
      return (
        <Box padding={2}>
          <Stack direction="column" gap={2}>
            {isLoadingDirect ? (
              <LoadingPlaceholder text={t('pulse.drawer.loading-thread', 'Loading thread…')} />
            ) : (
              <>
                <Text>
                  <Trans i18nKey="pulse.drawer.thread-missing">Thread not found.</Trans>
                </Text>
                <Button variant="secondary" onClick={() => setActiveThreadUID(null)}>
                  {t('pulse.drawer.back', 'Back to threads')}
                </Button>
              </>
            )}
          </Stack>
        </Box>
      );
    }
    return (
      <Box padding={2} display="flex" direction="column">
        <PulseThreadView
          thread={activeThread}
          panels={panels}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onMentionPanel={onMentionPanel}
          onBack={() => setActiveThreadUID(null)}
          onThreadDeleted={() => setActiveThreadUID(null)}
        />
      </Box>
    );
  }

  if (composing) {
    return (
      <Box padding={2}>
        <Stack direction="column" gap={2}>
          <Text element="h3" weight="medium">
            {panelId
              ? t('pulse.drawer.start-on-panel', 'Start a thread on panel #{{id}}', { id: panelId })
              : t('pulse.drawer.start-on-dashboard', 'Start a thread on this dashboard')}
          </Text>
          <PulseComposer
            panels={panels}
            autoFocus
            pending={createThreadState.isLoading}
            currentUserId={currentUserId}
            onCancel={() => setComposing(false)}
            onSubmit={async (body) => {
              const res = await createThread({
                resourceKind: 'dashboard',
                resourceUID,
                panelId,
                title: buildThreadPreviewTitle(body.markdown ?? bodyToText(body)),
                body,
              }).unwrap();
              setComposing(false);
              // Reset to page 0 so the user lands back on a list that
              // includes the thread they just authored when they
              // navigate back, rather than being stranded on a stale
              // page two.
              setCursorStack([]);
              setActiveThreadUID(res.thread.uid);
            }}
          />
        </Stack>
      </Box>
    );
  }

  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        <Stack justifyContent="space-between" alignItems="center">
          <Text element="h3" weight="medium">
            {panelId
              ? t('pulse.drawer.threads-on-panel', 'Threads on panel #{{id}}', { id: panelId })
              : t('pulse.drawer.threads-on-dashboard', 'Threads on this dashboard')}
          </Text>
          <Button size="sm" icon="plus" onClick={() => setComposing(true)}>
            {t('pulse.drawer.new-thread', 'Start a thread')}
          </Button>
        </Stack>
        {isLoading && <LoadingPlaceholder text={t('pulse.drawer.loading', 'Loading threads…')} />}
        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <EmptyState
            variant="not-found"
            message={t('pulse.drawer.empty-title', 'Nothing to discuss yet')}
            button={
              <Button onClick={() => setComposing(true)} icon="plus">
                {t('pulse.drawer.empty-cta', 'Start the first thread')}
              </Button>
            }
          >
            <Trans i18nKey="pulse.drawer.empty-body">
              Use Pulse to leave context-aware comments on this dashboard. Your team will be notified.
            </Trans>
          </EmptyState>
        )}
        <div className={styles.list}>
          {data?.items.map((t) => (
            <ThreadCard key={t.uid} thread={t} onClick={() => setActiveThreadUID(t.uid)} />
          ))}
        </div>
        {(data?.hasMore || cursorStack.length > 0) && (
          <Stack justifyContent="space-between" alignItems="center">
            <Button
              size="sm"
              variant="secondary"
              icon="angle-left"
              disabled={cursorStack.length === 0 || isFetching}
              onClick={() => setCursorStack((prev) => prev.slice(0, -1))}
            >
              {t('pulse.drawer.prev-page', 'Previous')}
            </Button>
            <Text variant="bodySmall" color="secondary">
              {/*
                The cursor stack length is also the zero-based index of
                the page we're viewing, so +1 gives a 1-based label that
                matches what users expect when they read "Page N".
              */}
              {t('pulse.drawer.page-indicator', 'Page {{page}}', { page: cursorStack.length + 1 })}
            </Text>
            <Button
              size="sm"
              variant="secondary"
              icon="angle-right"
              disabled={!data?.hasMore || isFetching}
              onClick={() => {
                if (data?.nextCursor) {
                  setCursorStack((prev) => [...prev, data.nextCursor!]);
                }
              }}
            >
              {t('pulse.drawer.next-page', 'Next')}
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

interface ThreadCardProps {
  thread: PulseThread;
  onClick: () => void;
}

function ThreadCard({ thread, onClick }: ThreadCardProps): ReactNode {
  const styles = useStyles2(getStyles);
  const authorLabel = thread.authorName || thread.authorLogin || t('pulse.drawer.thread-author-unknown', 'User');
  // Prefer rendering the first pulse's AST so mentions appear as styled
  // chips identical to the in-thread view. Fall back to the legacy title
  // (still useful when previewBody isn't available, e.g. cached
  // pre-upgrade list payloads), and only as a last resort to a generic
  // label so the card never renders empty.
  const headingFallback = thread.title?.trim() || t('pulse.drawer.thread-fallback', 'Conversation');

  return (
    <Card noMargin href={undefined} onClick={onClick}>
      <Card.Figure>
        {thread.authorAvatarUrl ? (
          <Avatar
            src={thread.authorAvatarUrl}
            alt={t('pulse.drawer.thread-author-avatar-alt', 'Avatar for {{name}}', { name: authorLabel })}
            width={4}
            height={4}
          />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true" />
        )}
      </Card.Figure>
      <Card.Heading>
        <div className={styles.previewBox}>
          {thread.previewBody ? <PulseRenderer body={thread.previewBody} /> : headingFallback}
        </div>
      </Card.Heading>
      <Card.Description>
        <Stack direction="column" gap={0.25}>
          <span>
            <span className={styles.author}>{authorLabel}</span>
            {' \u00b7 '}
            {/*
              pulseCount is the total number of pulses in the thread,
              including the parent. The parent isn't a "reply" so
              subtract one before showing it; clamp at zero to be
              defensive against legacy rows where pulseCount somehow
              ended up as zero.
            */}
            {t('pulse.drawer.thread-meta', '{{count}} replies', {
              count: Math.max(0, thread.pulseCount - 1),
            })}
            {thread.closed && (
              <>
                {' \u00b7 '}
                <span className={styles.closedTag}>
                  <Icon name="lock" size="xs" />
                  <span>{t('pulse.drawer.closed-tag', 'Closed')}</span>
                </span>
              </>
            )}
          </span>
          <span className={styles.lastActivity}>
            {/*
              dateTimeFormatTimeAgo gives us "5 minutes ago" / "yesterday"
              style relative output, which keeps the card light without
              demanding precise timestamps.
            */}
            {t('pulse.drawer.last-activity', 'Last activity: {{when}}', {
              when: dateTimeFormatTimeAgo(thread.lastPulseAt),
            })}
          </span>
        </Stack>
      </Card.Description>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  // The thread card heading hosts the rendered first-pulse AST. We
  // clamp to two lines via -webkit-box so mention chips, links, and
  // long prose all degrade the same way; without the inner-paragraph
  // margin reset PulseRenderer's default `<p>` styling would push the
  // second line off the clamp.
  previewBox: css({
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'normal',
    '& p': {
      margin: 0,
      display: 'inline',
    },
  }),
  avatarFallback: css({
    display: 'inline-block',
    width: theme.spacing(4),
    height: theme.spacing(4),
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.background.secondary,
  }),
  // Closed threads get a pill that visually breaks from the row's
  // running prose so it reads as state rather than as more metadata.
  // The lock icon reinforces the affordance and matches the lock /
  // unlock IconButtons used inside the thread view.
  closedTag: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    verticalAlign: 'middle',
  }),
  lastActivity: css({
    fontStyle: 'italic',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  author: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
});

function buildThreadPreviewTitle(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }

  const sentenceMatch = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  const firstSentence = sentenceMatch ? sentenceMatch[1] : normalized;
  const maxChars = 160;
  if (firstSentence.length <= maxChars) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, maxChars - 1).trimEnd()}…`;
}
