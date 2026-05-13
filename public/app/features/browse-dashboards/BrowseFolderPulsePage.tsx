import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom-v5-compat';
import { useDebounce } from 'react-use';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Alert,
  Avatar,
  Box,
  Button,
  type Column,
  Combobox,
  type ComboboxOption,
  Drawer,
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
import { contextSrv } from 'app/core/services/context_srv';
import { buildNavModel, getPulseTabID } from 'app/features/folders/state/navModel';
import {
  type ThreadStatusFilter,
  useCreateThreadMutation,
  useGetResourceVersionQuery,
  useGetThreadQuery,
  useListParticipantsQuery,
  useListThreadsQuery,
} from 'app/features/pulse/api/pulseApi';
import { PulseComposer } from 'app/features/pulse/components/PulseComposer';
import { PulseRenderer } from 'app/features/pulse/components/PulseRenderer';
import { PulseThreadView } from 'app/features/pulse/components/PulseThreadView';
import { useFolderDashboards } from 'app/features/pulse/hooks/useFolderDashboards';
import { useResourcePulseStream } from 'app/features/pulse/hooks/useResourcePulseStream';
import { type PulseThread } from 'app/features/pulse/types';
import { bodyToText } from 'app/features/pulse/utils/body';

import { FolderDetailsActions } from './components/FolderDetailsActions/FolderDetailsActions';

const PAGE_SIZE = 25;

const FILTER_ALL = '__all__';

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
 * BrowseFolderPulsePage hosts the Pulse experience for a folder. It is
 * the folder-scoped counterpart to the dashboard's PulseDrawer: threads
 * on the page are filtered to `resourceKind=folder, resourceUID=<uid>`,
 * the composer's `#` picker offers the folder's child dashboards as
 * mention targets, and the live channel subscribes on the same kind/uid
 * pair so the list updates immediately when other users post.
 *
 * State machine:
 *   list  ──"+ New thread"──> drawer composer ──"send"──> open new thread
 *   list  ──click row──>      thread view     ──"back"──> list
 *
 * The drawer + inline thread view mirror the dashboard drawer's layout
 * so the two surfaces feel like one product even though they live in
 * very different host pages.
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
  const currentUserId = contextSrv.user.id;
  const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);

  // Deep-link support: `?pulse=thread-<uid>` opens that thread on
  // mount, mirroring the dashboard drawer's URL contract so links from
  // the global Pulse overview land the user inside the thread directly.
  // The active thread uid lives in the URL so back/forward, bookmark,
  // and cross-tab share all behave as expected. Status + scope live in
  // the URL too so a "send your colleague the closed threads I'm in"
  // link is one copy/paste away.
  const [searchParams, setSearchParams] = useSearchParams();
  const pulseParam = searchParams.get('pulse');
  const scope: Scope = searchParams.get('scope') === 'mine' ? 'mine' : 'all';
  const status: StatusOption = parseStatusParam(searchParams.get('status'));
  const updateFilterParam = useCallback(
    (key: 'scope' | 'status', value: string | null) => {
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
    },
    [searchParams, setSearchParams]
  );
  const activeThreadUID = useMemo(() => {
    if (typeof pulseParam !== 'string') {
      return null;
    }
    if (pulseParam.startsWith('thread-')) {
      const uid = pulseParam.slice('thread-'.length).trim();
      return uid || null;
    }
    return null;
  }, [pulseParam]);
  const openThread = useCallback(
    (uid: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('pulse', `thread-${uid}`);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );
  const closeThread = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('pulse');
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

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

  // Polling fallback + live-channel subscription, both keyed by
  // (folder kind, folder uid). The live channel triggers RTK cache
  // invalidations on each event; the polling query catches up when
  // Live is unreachable (proxy strips WebSockets, etc.).
  useGetResourceVersionQuery(
    { resourceKind: 'folder', resourceUID: folderUID },
    { pollingInterval: 15_000, skip: !folderUID }
  );
  useResourcePulseStream({ resourceKind: 'folder', resourceUID: folderUID, enabled: !!folderUID });

  const { data: participantsData } = useListParticipantsQuery(
    { resourceKind: 'folder', resourceUID: folderUID },
    { skip: !folderUID }
  );

  const userOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const opts: Array<ComboboxOption<string>> = [
      { value: FILTER_ALL, label: t('browse-dashboards.folder-pulse.filter-user-all', 'All users') },
    ];
    for (const p of participantsData?.participants ?? []) {
      const label =
        p.name?.trim() ||
        p.login?.trim() ||
        t('browse-dashboards.folder-pulse.filter-user-fallback', 'User #{{id}}', { id: p.userId });
      opts.push({ value: String(p.userId), label });
    }
    return opts;
  }, [participantsData]);

  const { data, isLoading, isFetching, error } = useListThreadsQuery({
    resourceKind: 'folder',
    resourceUID: folderUID,
    authorUserId: authorFilter,
    q: searchQuery || undefined,
    mine: scope === 'mine',
    // "all" is encoded as an absent param so the request URL stays
    // clean on the default view; matches the global overview.
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

  const hasActiveFilters =
    authorFilter !== undefined || searchQuery !== '' || scope !== 'all' || status !== 'all';

  // Mention picker source: folder's direct child dashboards. Loaded
  // whenever the composer drawer is open or a thread view is active
  // (so replies inside the thread also have the picker). The hook
  // cancels stale requests on close/folder-change.
  const childDashboardsEnabled = composing || activeThreadUID !== null;
  const childDashboards = useFolderDashboards(folderUID, childDashboardsEnabled);
  const folderResourceMention = useMemo(
    () => ({ kind: 'dashboard' as const, suggestions: childDashboards.items }),
    [childDashboards.items]
  );

  const [createThread, createThreadState] = useCreateThreadMutation();

  // Active thread can be opened either by clicking a row in the
  // list (always populated in `data`) or by deep-link from elsewhere
  // (the global overview). The getThread query covers the deep-link
  // case so the user lands inside the thread directly.
  const threadFromList = activeThreadUID ? data?.items.find((tt) => tt.uid === activeThreadUID) : undefined;
  const { data: directThread, isLoading: isLoadingDirect } = useGetThreadQuery(activeThreadUID ?? '', {
    skip: !activeThreadUID || !!threadFromList,
  });
  const activeThread = threadFromList ?? directThread;

  const columns = useMemo<Array<Column<PulseThread>>>(
    () => [
      {
        id: 'thread',
        header: t('browse-dashboards.folder-pulse.column.thread', 'Thread'),
        cell: ({ row: { original } }) => <ThreadCell thread={original} onOpen={() => openThread(original.uid)} />,
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
    [openThread]
  );

  if (activeThreadUID) {
    if (!activeThread) {
      return (
        <Box padding={2}>
          <Stack direction="column" gap={2}>
            {isLoadingDirect ? (
              <LoadingPlaceholder text={t('browse-dashboards.folder-pulse.loading-thread', 'Loading thread…')} />
            ) : (
              <>
                <Text>
                  <Trans i18nKey="browse-dashboards.folder-pulse.thread-missing">Thread not found.</Trans>
                </Text>
                <Button variant="secondary" onClick={closeThread}>
                  {t('browse-dashboards.folder-pulse.back', 'Back to threads')}
                </Button>
              </>
            )}
          </Stack>
        </Box>
      );
    }
    return (
      <Box padding={0} display="flex" direction="column">
        <PulseThreadView
          thread={activeThread}
          panels={[]}
          resourceMention={folderResourceMention}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onBack={closeThread}
          onThreadDeleted={closeThread}
        />
      </Box>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <FilterInput
            placeholder={t(
              'browse-dashboards.folder-pulse.search-placeholder',
              'Search by thread content'
            )}
            value={searchInput}
            onChange={setSearchInput}
          />
        </div>
        <Combobox
          options={userOptions}
          value={authorFilter !== undefined ? String(authorFilter) : FILTER_ALL}
          onChange={(option) => {
            // The "All" sentinel encodes the cleared state as a normal
            // option rather than relying on a separate clear affordance.
            if (option.value === FILTER_ALL) {
              setAuthorFilter(undefined);
              setPage(1);
              return;
            }
            const id = parseInt(option.value, 10);
            setAuthorFilter(Number.isNaN(id) ? undefined : id);
            setPage(1);
          }}
        />
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
        <Button icon="plus" onClick={() => setComposing(true)}>
          {t('browse-dashboards.folder-pulse.new-thread', 'New thread')}
        </Button>
      </div>

      {isLoading && !data && (
        <Box padding={4}>
          <LoadingPlaceholder text={t('browse-dashboards.folder-pulse.loading', 'Loading threads…')} />
        </Box>
      )}

      {!isLoading && threads.length === 0 && (
        // The empty-state carries three distinct cases — filtered miss,
        // unfiltered (nothing in the folder yet), and load failure —
        // through one component so the page never trades the illustrated
        // empty state for a bare red banner. Mirrors PulseDrawerContent,
        // which similarly treats "no data" as one visual surface
        // regardless of whether the cause was a successful empty
        // response or a failed request.
        <EmptyState
          variant="not-found"
          message={
            error
              ? t('browse-dashboards.folder-pulse.empty.error', "Couldn't load Pulse threads")
              : hasActiveFilters
                ? t('browse-dashboards.folder-pulse.empty.filtered', 'No matching threads')
                : t('browse-dashboards.folder-pulse.empty.all', 'No threads in this folder yet')
          }
          button={
            !hasActiveFilters && !error ? (
              <Button icon="plus" onClick={() => setComposing(true)}>
                {t('browse-dashboards.folder-pulse.empty.start', 'Start the first thread')}
              </Button>
            ) : undefined
          }
        >
          <Text color="secondary">
            {error ? (
              <Trans i18nKey="browse-dashboards.folder-pulse.empty.error-hint">
                Something went wrong while fetching threads. Please refresh and try again.
              </Trans>
            ) : hasActiveFilters ? (
              <Trans i18nKey="browse-dashboards.folder-pulse.empty.filtered-hint">
                Try clearing the search, user, status, or scope filters.
              </Trans>
            ) : (
              <Trans i18nKey="browse-dashboards.folder-pulse.empty.all-hint">
                Use threads to discuss the dashboards in this folder. Mention dashboards with #name and teammates
                with @name.
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

      {composing && (
        <Drawer
          title={t('browse-dashboards.folder-pulse.compose-title', 'Start a thread in this folder')}
          onClose={() => setComposing(false)}
          size="md"
        >
          <PulseComposer
            autoFocus
            pending={createThreadState.isLoading}
            currentUserId={currentUserId}
            showTitle
            titlePlaceholder={t(
              'browse-dashboards.folder-pulse.compose-title-placeholder',
              'Title — short summary of this thread (required)'
            )}
            resourceMention={folderResourceMention}
            onCancel={() => setComposing(false)}
            onSubmit={async (body, title) => {
              const res = await createThread({
                resourceKind: 'folder',
                resourceUID: folderUID,
                title,
                body,
              }).unwrap();
              setComposing(false);
              setPage(1);
              openThread(res.thread.uid);
            }}
          />
        </Drawer>
      )}
    </Stack>
  );
}

interface ThreadCellProps {
  thread: PulseThread;
  onOpen: () => void;
}

function ThreadCell({ thread, onOpen }: ThreadCellProps): React.ReactElement {
  const styles = useStyles2(getStyles);
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
      <TextLink href="#" weight="medium" inline={false} color="primary" onClick={onOpen}>
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
