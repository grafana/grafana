import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom-v5-compat';
import { useDebounce } from 'react-use';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Alert,
  Avatar,
  Box,
  type Column,
  EmptyState,
  FilterInput,
  Icon,
  InteractiveTable,
  LoadingPlaceholder,
  Pagination,
  RadioButtonGroup,
  Stack,
  Text,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { useGetFolderQueryFacade, useUpdateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { Page } from 'app/core/components/Page/Page';
import { buildNavModel, getPulseTabID } from 'app/features/folders/state/navModel';
import { type ThreadStatusFilter, useListFolderRollupThreadsQuery } from 'app/features/pulse/api/pulseApi';
import { PulseRenderer } from 'app/features/pulse/components/PulseRenderer';
import { type PulseThread } from 'app/features/pulse/types';
import { bodyToText } from 'app/features/pulse/utils/body';

import { FolderDetailsActions } from './components/FolderDetailsActions/FolderDetailsActions';

const PAGE_SIZE = 25;

/**
 * Scope encodes the "show only threads I'm in" toggle. Same shape as
 * the global overview so users carry the same mental model between
 * the two surfaces.
 */
type Scope = 'all' | 'mine';

/**
 * StatusOption mirrors the backend's ThreadStatusFilter plus an
 * explicit "all" sentinel for the UI. The radio group sends "all" →
 * undefined over the wire so the API treats it as the default no-op
 * filter (matches the global overview's encoding).
 */
type StatusOption = 'all' | ThreadStatusFilter;

/**
 * parseStatusParam keeps the URL → state mapping in one place so a
 * hand-edited `?status=…` value can never push the radio group into
 * an invalid state. Anything outside {open, closed} collapses to the
 * "all" default — same defensive shape the backend uses.
 */
function parseStatusParam(raw: string | null): StatusOption {
  if (raw === 'open' || raw === 'closed') {
    return raw;
  }
  return 'all';
}

/**
 * BrowseFolderPulsePage hosts the Pulse experience for a folder. The
 * folder is *not* a Pulse resource — threads live on dashboards
 * directly. This page is a roll-up: it asks the backend for every
 * thread attached to a dashboard the caller can read under this
 * folder hierarchy (root + descendant folders) and renders them as
 * a read-only table. Each row links back to the dashboard with the
 * Pulse drawer pre-opened to the right thread, so the conversation
 * itself always happens on the dashboard surface.
 *
 * No composer / new-thread affordance lives on this page on
 * purpose: there is no such thing as a "thread on a folder", so
 * surfacing a "+ New thread" button here would mislead the user
 * about what they were creating.
 */
export function BrowseFolderPulsePage() {
  const { uid: folderUID = '' } = useParams();
  const { data: folderDTO, isLoading: isFolderLoading } = useGetFolderQueryFacade(folderUID);
  const [saveFolder] = useUpdateFolder();

  const navModel = useMemo(() => {
    if (!folderDTO) {
      return undefined;
    }
    const model = buildNavModel(folderDTO);
    const pulseTabID = getPulseTabID(folderDTO.uid);
    const pulseTab = model.children?.find((child) => child.id === pulseTabID);
    if (pulseTab) {
      pulseTab.active = true;
    }
    return model;
  }, [folderDTO]);

  const onEditTitle = folderUID
    ? async (newValue: string) => {
        if (folderDTO) {
          const result = await saveFolder({
            ...folderDTO,
            title: newValue,
          });
          if ('error' in result) {
            throw result.error;
          }
        }
      }
    : undefined;

  return (
    <Page
      navId="dashboards/browse"
      pageNav={navModel}
      onEditTitle={onEditTitle}
      actions={folderDTO && <FolderDetailsActions folderDTO={folderDTO} />}
    >
      <Page.Contents isLoading={isFolderLoading}>
        {!folderDTO ? (
          <Alert title={t('browse-dashboards.browse-folder-pulse-page.title-folder-not-found', 'Folder not found')} />
        ) : (
          <FolderPulseContent folderUID={folderDTO.uid} />
        )}
      </Page.Contents>
    </Page>
  );
}

interface FolderPulseContentProps {
  folderUID: string;
}

/**
 * FolderPulseContent is the inner of the folder Pulse page once the
 * folder has resolved. Exported (rather than kept module-private)
 * so the test suite can render it with a mock folder UID without
 * pulling in the Page chrome, the folder API facade, or the
 * breadcrumb nav model.
 */
export function FolderPulseContent({ folderUID }: FolderPulseContentProps) {
  const styles = useStyles2(getStyles);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Status + scope live in the URL so a "send your colleague the
  // closed threads I'm in" link is one copy/paste away. Mirrors the
  // global Pulse overview's URL contract for cross-surface muscle
  // memory.
  const [searchParams, setSearchParams] = useSearchParams();
  const scope: Scope = searchParams.get('scope') === 'mine' ? 'mine' : 'all';
  const status: StatusOption = parseStatusParam(searchParams.get('status'));

  function updateFilterParam(key: 'scope' | 'status', value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === 'all') {
      // The "all" sentinel and the unset state encode identically in
      // the URL so the default view doesn't grow noise.
      next.delete(key);
    } else {
      next.set(key, value);
    }
    // Resetting to page 1 keeps the user from landing on an empty
    // page after a filter narrows the result set below their current
    // offset.
    next.delete('page');
    setSearchParams(next, { replace: false });
    setPage(1);
  }

  // Debounce the search input so typing doesn't fire a request per
  // keystroke. 250ms matches the dashboard drawer's debounce and the
  // global overview, giving users a consistent feel.
  useDebounce(
    () => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    },
    250,
    [searchInput]
  );

  const { data, isLoading, isFetching, error } = useListFolderRollupThreadsQuery({
    folderUID,
    q: searchQuery || undefined,
    mine: scope === 'mine',
    status: status === 'all' ? undefined : status,
    page,
    limit: PAGE_SIZE,
  });

  const threads = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // If a delete (or a paging-induced gap) leaves us pointing past the
  // end of the result set, snap to the new last page so the list
  // never renders blank.
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const hasActiveFilters = searchQuery !== '' || scope !== 'all' || status !== 'all';

  const columns = useMemo<Array<Column<PulseThread>>>(
    () => [
      {
        id: 'thread',
        header: t('browse-dashboards.folder-pulse.column.thread', 'Thread'),
        cell: ({ row: { original } }) => <ThreadCell thread={original} />,
      },
      {
        id: 'type',
        header: t('browse-dashboards.folder-pulse.column.type', 'Type'),
        cell: ({ row: { original } }) => (
          <Text variant="bodySmall" color="secondary">
            {formatResourceKind(original.resourceKind)}
          </Text>
        ),
        disableGrow: true,
      },
      {
        id: 'resource',
        header: t('browse-dashboards.folder-pulse.column.resource', 'Resource'),
        cell: ({ row: { original } }) => <ResourceCell thread={original} />,
      },
      {
        id: 'folder',
        header: t('browse-dashboards.folder-pulse.column.folder', 'Folder'),
        cell: ({ row: { original } }) => <FolderCell thread={original} />,
        disableGrow: true,
      },
      {
        id: 'author',
        header: t('browse-dashboards.folder-pulse.column.author', 'Author'),
        cell: ({ row: { original } }) => <AuthorCell thread={original} />,
        disableGrow: true,
      },
      {
        id: 'replies',
        header: t('browse-dashboards.folder-pulse.column.replies', 'Replies'),
        cell: ({ row: { original } }) => (
          <Text variant="bodySmall" color="secondary">
            {Math.max(0, original.pulseCount - 1)}
          </Text>
        ),
        disableGrow: true,
      },
      {
        id: 'last-activity',
        header: t('browse-dashboards.folder-pulse.column.last-activity', 'Last activity'),
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
    <Stack direction="column" gap={2}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <FilterInput
            placeholder={t(
              'browse-dashboards.folder-pulse.search-placeholder',
              'Search by thread content or dashboard title'
            )}
            value={searchInput}
            onChange={setSearchInput}
          />
        </div>
        <RadioButtonGroup<StatusOption>
          value={status}
          options={[
            { label: t('browse-dashboards.folder-pulse.status.all', 'All'), value: 'all' },
            { label: t('browse-dashboards.folder-pulse.status.open', 'Open'), value: 'open' },
            { label: t('browse-dashboards.folder-pulse.status.closed', 'Closed'), value: 'closed' },
          ]}
          onChange={(value) => updateFilterParam('status', value)}
        />
        <RadioButtonGroup<Scope>
          value={scope}
          options={[
            { label: t('browse-dashboards.folder-pulse.scope.all', 'All threads'), value: 'all' },
            { label: t('browse-dashboards.folder-pulse.scope.mine', 'My threads'), value: 'mine' },
          ]}
          onChange={(value) => updateFilterParam('scope', value)}
        />
      </div>

      {isLoading && !data && (
        <Box padding={4}>
          <LoadingPlaceholder text={t('browse-dashboards.folder-pulse.loading', 'Loading threads…')} />
        </Box>
      )}

      {!isLoading && threads.length === 0 && (
        // The empty-state carries three distinct cases — filtered miss,
        // unfiltered (no dashboards in the hierarchy have threads
        // yet), and load failure — through one component so the page
        // never trades the illustrated empty state for a bare red
        // banner.
        <EmptyState
          variant="not-found"
          message={
            error
              ? t('browse-dashboards.folder-pulse.empty.error', "Couldn't load Pulse threads")
              : hasActiveFilters
                ? t('browse-dashboards.folder-pulse.empty.filtered', 'No matching threads')
                : t('browse-dashboards.folder-pulse.empty.all', 'No Pulse threads on dashboards in this folder yet')
          }
        >
          <Text color="secondary">
            {error ? (
              <Trans i18nKey="browse-dashboards.folder-pulse.empty.error-hint">
                Something went wrong while fetching threads. Please refresh and try again.
              </Trans>
            ) : hasActiveFilters ? (
              <Trans i18nKey="browse-dashboards.folder-pulse.empty.filtered-hint">
                Try clearing the search, status, or scope filters.
              </Trans>
            ) : (
              <Trans i18nKey="browse-dashboards.folder-pulse.empty.all-hint">
                This view rolls up Pulse threads attached to dashboards in this folder and its subfolders. Open any
                dashboard to start a thread there.
              </Trans>
            )}
          </Text>
        </EmptyState>
      )}

      {threads.length > 0 && (
        <>
          <InteractiveTable columns={columns} data={threads} getRowId={(tt) => tt.uid} pageSize={PAGE_SIZE} />
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
                <Trans i18nKey="browse-dashboards.folder-pulse.refreshing">Updating…</Trans>
              </Text>
            </div>
          )}
        </>
      )}
    </Stack>
  );
}

function ThreadCell({ thread }: { thread: PulseThread }): React.ReactElement {
  const styles = useStyles2(getStyles);
  const href = buildThreadHref(thread);
  const previewText = thread.previewBody ? bodyToText(thread.previewBody) : (thread.title ?? '');
  const threadTitle = thread.title?.trim() ?? '';
  // Suppress the preview body when it's effectively the title repeated
  // (legacy rows where the title was auto-derived from the first
  // sentence of the body). New threads carry an explicit user-supplied
  // title and a distinct body, so they always render the preview.
  const previewMatchesTitle =
    threadTitle.length > 0 && normalizeForCompare(previewText) === normalizeForCompare(threadTitle);
  const showPreviewBody = Boolean(thread.previewBody) && !previewMatchesTitle;
  const label =
    thread.title ||
    (previewText.length > 0
      ? truncate(previewText, 80)
      : t('browse-dashboards.folder-pulse.untitled', 'Untitled thread'));
  return (
    <Stack direction="column" gap={0.5}>
      <TextLink href={href} weight="medium" inline={false} color="primary">
        {label}
      </TextLink>
      {showPreviewBody && thread.previewBody ? (
        <div className={styles.preview}>
          <PulseRenderer body={thread.previewBody} />
        </div>
      ) : null}
      {thread.closed && (
        <span className={styles.closedTag}>
          <Icon name="lock" size="xs" />
          <Trans i18nKey="browse-dashboards.folder-pulse.closed">Closed</Trans>
        </span>
      )}
    </Stack>
  );
}

function ResourceCell({ thread }: { thread: PulseThread }): React.ReactElement {
  const href = buildThreadHref(thread);
  const label = thread.resourceTitle?.trim() || thread.resourceUID;
  return (
    <TextLink href={href} inline={false}>
      {label}
    </TextLink>
  );
}

/**
 * FolderCell renders the dashboard's parent folder so the rollup
 * view can show "where does this thread live". Threads on
 * dashboards in the root render an em dash rather than a broken
 * link, and rows whose backend-provided folderUID is missing fall
 * back to the same dash for the same reason.
 */
function FolderCell({ thread }: { thread: PulseThread }): React.ReactElement {
  if (!thread.folderUID) {
    return (
      <Text variant="bodySmall" color="secondary">
        —
      </Text>
    );
  }
  const href = `/dashboards/f/${encodeURIComponent(thread.folderUID)}`;
  const label = thread.folderTitle?.trim() || thread.folderUID;
  return (
    <TextLink href={href} inline={false}>
      {label}
    </TextLink>
  );
}

function AuthorCell({ thread }: { thread: PulseThread }): React.ReactElement {
  const name =
    thread.authorName?.trim() ||
    thread.authorLogin?.trim() ||
    t('browse-dashboards.folder-pulse.author-unknown', 'Unknown');
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      {thread.authorAvatarUrl ? <Avatar src={thread.authorAvatarUrl} alt="" width={2.5} height={2.5} /> : null}
      <Text variant="bodySmall">{name}</Text>
    </Stack>
  );
}

/**
 * formatResourceKind turns a wire-level resource kind ("dashboard")
 * into a human-readable column value ("Dashboard"). Capitalises the
 * first character only — kinds are single lowercase tokens by
 * contract — and leaves an empty string alone so a malformed row
 * never renders a partial token.
 */
function formatResourceKind(kind: string): string {
  if (!kind) {
    return '';
  }
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/**
 * buildThreadHref hands back the canonical link to a thread. For
 * the folder rollup the underlying resource is always a dashboard,
 * so we route to /d/<uid> with the deep-link query param the
 * dashboard's PulseDrawer reads to auto-open the thread.
 */
function buildThreadHref(thread: PulseThread): string {
  const encoded = encodeURIComponent(thread.resourceUID);
  const url = new URL(`/d/${encoded}`, window.location.origin);
  url.searchParams.set('pulse', `thread-${thread.uid}`);
  return `${url.pathname}${url.search}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max - 1).trimEnd() + '…';
}

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** isPulseEnabled gates the Pulse tab on the same feature toggle the
 *  dashboard drawer uses, so toggling Pulse off hides both surfaces
 *  consistently. Exported for use in navModel.ts. */
export function isPulseEnabled(): boolean {
  return Boolean(config.featureToggles.dashboardPulse);
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
      // Clamp the preview to two lines so a chatty opening pulse
      // never elbows the table out of shape; the user can click
      // through for the full conversation.
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }),
    refreshing: css({
      textAlign: 'center',
      paddingTop: theme.spacing(1),
    }),
    // Mirrors the closed pill in the overview / drawer so the
    // affordance looks identical wherever a thread is rendered.
    closedTag: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.pill,
      background: 'transparent',
      color: theme.colors.text.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      alignSelf: 'flex-start',
    }),
  };
}

export default BrowseFolderPulsePage;
