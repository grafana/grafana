import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Avatar,
  Box,
  EmptyState,
  FilterInput,
  type Column,
  InteractiveTable,
  LoadingPlaceholder,
  Pagination,
  RadioButtonGroup,
  Stack,
  Text,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useListAllThreadsQuery } from './api/pulseApi';
import { PulseRenderer } from './components/PulseRenderer';
import { type PulseThread } from './types';
import { bodyToText } from './utils/body';

// One page of threads. Larger than the in-dashboard drawer's 10
// because the overview is meant for at-a-glance scanning across the
// whole org; smaller than 50 because each row renders an inline
// preview which gets visually heavy.
const PAGE_SIZE = 25;

type Scope = 'all' | 'mine';

/**
 * PulsePage is the org-wide overview of every Pulse thread the user can
 * see. Each row links to the underlying dashboard with `?pulse=thread-<uid>`
 * so opening a row hops to that dashboard and auto-opens the thread in
 * the dashboard's Pulse drawer.
 *
 * Filters:
 *   - search (q): matches thread titles AND any pulse body text
 *   - scope: all threads in the org vs threads the caller participates in
 *
 * Pagination is offset-based; the InteractiveTable below renders one
 * page at a time and the bottom Pagination lets the user jump pages.
 */
export default function PulsePage() {
  const styles = useStyles2(getStyles);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [page, setPage] = useState(1);

  // Debounce search to avoid hammering the API on every keystroke. The
  // backend's LIKE query is cheap on the indexes we have but we still
  // want a smooth feel — 250ms keeps it perceptibly instant.
  useDebounce(
    () => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    },
    250,
    [searchInput]
  );

  const { data, isLoading, isFetching, error } = useListAllThreadsQuery({
    q: searchQuery || undefined,
    mine: scope === 'mine',
    page,
    limit: PAGE_SIZE,
  });

  const threads = data?.items ?? [];
  const totalPages = data?.totalCount ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  const columns = useMemo<Array<Column<PulseThread>>>(
    () => [
      {
        id: 'thread',
        header: t('pulse.overview.column.thread', 'Thread'),
        cell: ({ row: { original } }) => <ThreadCell thread={original} />,
      },
      {
        id: 'dashboard',
        header: t('pulse.overview.column.dashboard', 'Dashboard'),
        cell: ({ row: { original } }) => <DashboardCell thread={original} />,
      },
      {
        id: 'replies',
        header: t('pulse.overview.column.replies', 'Replies'),
        cell: ({ row: { original } }) => (
          <Text variant="bodySmall" color="secondary">
            {Math.max(0, original.pulseCount - 1)}
          </Text>
        ),
        disableGrow: true,
      },
      {
        id: 'last-activity',
        header: t('pulse.overview.column.last-activity', 'Last activity'),
        cell: ({ row: { original } }) => (
          <Text variant="bodySmall" color="secondary">
            {dateTimeFormatTimeAgo(original.lastPulseAt)}
          </Text>
        ),
        disableGrow: true,
      },
    ],
    []
  );

  return (
    <Page
      navId="pulse"
      subTitle={t(
        'pulse.overview.subtitle',
        'Browse every Pulse thread across your dashboards. Open a thread to jump straight into the conversation.'
      )}
    >
      <Page.Contents>
        <Stack direction="column" gap={2}>
          <div className={styles.toolbar}>
            <div className={styles.search}>
              <FilterInput
                placeholder={t('pulse.overview.search-placeholder', 'Search by thread content or dashboard title')}
                value={searchInput}
                onChange={setSearchInput}
              />
            </div>
            <RadioButtonGroup<Scope>
              value={scope}
              options={[
                { label: t('pulse.overview.scope.all', 'All threads'), value: 'all' },
                { label: t('pulse.overview.scope.mine', 'My threads'), value: 'mine' },
              ]}
              onChange={(value) => {
                setScope(value);
                setPage(1);
              }}
            />
          </div>

          {Boolean(error) && (
            <Alert
              severity="error"
              title={t('pulse.overview.error.title', 'Failed to load Pulse threads')}
              topSpacing={2}
            >
              {t(
                'pulse.overview.error.message',
                'Something went wrong while fetching threads. Please refresh and try again.'
              )}
            </Alert>
          )}

          {isLoading && !data && (
            <Box padding={4}>
              <LoadingPlaceholder text={t('pulse.overview.loading', 'Loading threads…')} />
            </Box>
          )}

          {!isLoading && threads.length === 0 && !error && (
            <EmptyState
              variant="not-found"
              message={
                scope === 'mine' || searchQuery
                  ? t('pulse.overview.empty.filtered', 'No matching threads')
                  : t('pulse.overview.empty.all', 'No threads yet')
              }
            >
              <Text color="secondary">
                {scope === 'mine' || searchQuery ? (
                  <Trans i18nKey="pulse.overview.empty.filtered-hint">
                    Try clearing the search or switching back to all threads.
                  </Trans>
                ) : (
                  <Trans i18nKey="pulse.overview.empty.all-hint">
                    Start a thread on any dashboard panel and it will appear here.
                  </Trans>
                )}
              </Text>
            </EmptyState>
          )}

          {threads.length > 0 && (
            <>
              <InteractiveTable columns={columns} data={threads} getRowId={(t) => t.uid} pageSize={PAGE_SIZE} />
              {totalPages > 1 && (
                <Stack justifyContent="center">
                  <Pagination
                    currentPage={page}
                    numberOfPages={totalPages}
                    onNavigate={(p) => setPage(p)}
                    hideWhenSinglePage
                  />
                </Stack>
              )}
              {isFetching && data && (
                <div className={styles.refreshing}>
                  <Text variant="bodySmall" color="secondary">
                    <Trans i18nKey="pulse.overview.refreshing">Updating…</Trans>
                  </Text>
                </div>
              )}
            </>
          )}
        </Stack>
      </Page.Contents>
    </Page>
  );
}

function ThreadCell({ thread }: { thread: PulseThread }): React.ReactElement {
  const styles = useStyles2(getStyles);
  const href = buildThreadHref(thread);
  // Prefer the rich preview body when the server populated it; fall
  // back to the thread title or a graceful placeholder.
  const previewText = thread.previewBody ? bodyToText(thread.previewBody) : (thread.title ?? '');
  return (
    <Stack direction="row" alignItems="flex-start" gap={1}>
      {thread.authorAvatarUrl && <Avatar src={thread.authorAvatarUrl} alt="" width={3} height={3} />}
      <Stack direction="column" gap={0.5}>
        <TextLink href={href} weight="medium" inline={false} color="primary">
          {thread.title ||
            (previewText.length > 0 ? truncate(previewText, 80) : t('pulse.overview.untitled', 'Untitled thread'))}
        </TextLink>
        {thread.previewBody ? (
          <div className={styles.preview}>
            <PulseRenderer body={thread.previewBody} />
          </div>
        ) : null}
        {thread.closed && (
          <Text variant="bodySmall" color="warning" italic>
            <Trans i18nKey="pulse.overview.closed">Closed</Trans>
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

function DashboardCell({ thread }: { thread: PulseThread }): React.ReactElement {
  const href = buildThreadHref(thread);
  const label = thread.resourceTitle?.trim() || thread.resourceUID;
  return (
    <TextLink href={href} inline={false}>
      {label}
    </TextLink>
  );
}

/**
 * buildThreadHref returns the canonical link to a thread:
 *   /d/<dashboard-uid>?pulse=thread-<thread-uid>
 *
 * The dashboard reads `pulse=thread-<uid>` via PulseDrawer's URL sync
 * and opens straight to that thread.
 */
function buildThreadHref(thread: PulseThread): string {
  const url = new URL(`/d/${encodeURIComponent(thread.resourceUID)}`, window.location.origin);
  url.searchParams.set('pulse', `thread-${thread.uid}`);
  // Return only the path + search so we hand a relative URL to the
  // router; we don't want to force a full page reload.
  return `${url.pathname}${url.search}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max - 1).trimEnd() + '…';
}

function getStyles(theme: GrafanaTheme2) {
  return {
    toolbar: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      flexWrap: 'wrap',
    }),
    search: css({
      flex: '1 1 320px',
      minWidth: '240px',
    }),
    preview: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      // Clamp to two lines so a long opening pulse never elbows the
      // table out of shape; the user can still click through for the
      // full conversation.
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }),
    refreshing: css({
      textAlign: 'center',
      paddingTop: theme.spacing(1),
    }),
  };
}
