import { css } from '@emotion/css';
import { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Avatar,
  Box,
  Button,
  Card,
  Combobox,
  type ComboboxOption,
  EmptyState,
  Field,
  Icon,
  Input,
  LoadingPlaceholder,
  Pagination,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

import {
  useCreateThreadMutation,
  useGetResourceVersionQuery,
  useGetThreadQuery,
  useListParticipantsQuery,
  useListPanelMentionsQuery,
  useListThreadsQuery,
} from '../api/pulseApi';
import { useAssistantAutoReply } from '../hooks/useAssistantAutoReply';
import { useResourcePulseStream } from '../hooks/useResourcePulseStream';
import { type PulseThread } from '../types';
import { type PanelSuggestion } from '../utils/lookups';

import { PulseComposer, type CurrentTimeRange, type ResourceMentionSource } from './PulseComposer';
import { PulseRenderer } from './PulseRenderer';
import { PulseThreadView } from './PulseThreadView';

interface Props {
  resourceUID: string;
  panelFilter?: number;
  authorFilter?: number;
  /** Free-form search needle. Empty / whitespace-only is no filter. */
  searchFilter?: string;
  panels?: PanelSuggestion[];
  /** Extra resource sources for the composer's `#` picker on this
   *  surface. The dashboard drawer passes sibling dashboards here so
   *  a thread can reference other dashboards in the same folder
   *  without leaving the drawer. Folder-scoped or alert-scoped
   *  surfaces hook in their own kinds the same way. */
  resourceMentions?: ResourceMentionSource[];
  currentUserId?: number;
  isAdmin?: boolean;
  /** Dashboard's live time range, forwarded to the composer so `@now`
   *  / `@time` insertions can freeze the current window into a chip.
   *  Sampled at render time — the chip captures whatever was current
   *  when the user selected the suggestion. */
  currentTimeRange?: CurrentTimeRange;
  /** Called when the user clicks a time mention chip. When set, the
   *  renderer suppresses the chip's default anchor navigation and
   *  routes through this callback instead, so the dashboard time
   *  picker updates in place. Omit on surfaces without a mounted
   *  dashboard (notification previews) — the chip then falls back
   *  to plain anchor navigation. */
  onTimeChipClick?: (from: number, to: number) => void;
  onMentionPanel?: (panelId: number) => void;
  onPanelFilterChange?: (panelId: number | undefined) => void;
  onAuthorFilterChange?: (userId: number | undefined) => void;
  onSearchFilterChange?: (query: string | undefined) => void;
  onClearFilters?: () => void;
  /** When set, the drawer auto-opens this thread on mount (deep link from
   *  the global Pulse overview). Cleared via onInitialThreadOpened so a
   *  subsequent "Back" doesn't snap back to the deep-linked thread. */
  initialThreadUID?: string;
  onInitialThreadOpened?: () => void;
}

/** Sentinel for the "no filter" Combobox option. Numeric panel/user
 *  ids never collide with this string so we can encode it in the
 *  same `value` slot. */
const FILTER_ALL = '__all__';

/** Debounce window for the free-form search input. Long enough to
 *  avoid a request per keystroke on a slow link, short enough that
 *  it doesn't feel laggy when the user pauses to read results. */
const SEARCH_DEBOUNCE_MS = 250;

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
  panelFilter,
  authorFilter,
  searchFilter,
  panels,
  resourceMentions,
  currentUserId,
  isAdmin = false,
  currentTimeRange,
  onTimeChipClick,
  onMentionPanel,
  onPanelFilterChange,
  onAuthorFilterChange,
  onSearchFilterChange,
  onClearFilters,
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
  // 1-indexed page state. Offset pagination here (rather than a
  // cursor stack) so the numbered pager can let the user click
  // "Page 5" directly — cursor pagination would force them to walk
  // forward through every prior page first. RTK Query caches each
  // (page, filters) tuple, so revisiting a previous page is a cache
  // hit, not a refetch.
  const [currentPage, setCurrentPage] = useState(1);

  // When the user changes the resource OR any filter, the page index
  // is meaningless against the new result set — reset to page 1 so
  // the list always lands on the most-recent slice.
  useEffect(() => {
    setCurrentPage(1);
  }, [resourceUID, panelFilter, authorFilter, searchFilter]);

  // Local search state: tracks what the user is typing right now so
  // the input stays responsive while we debounce the URL/network
  // round-trip. We only push the trimmed value upstream — empty /
  // whitespace-only edits should clear the URL key, not pin it to
  // an empty string.
  const [searchDraft, setSearchDraft] = useState(searchFilter ?? '');
  // External resets (Clear filters, deep-link nav, etc.) need to
  // overwrite whatever the user was typing. Compare against the
  // canonical value so we don't fight the user mid-keystroke.
  useEffect(() => {
    setSearchDraft(searchFilter ?? '');
  }, [searchFilter]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  const onSearchInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setSearchDraft(next);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        const trimmed = next.trim();
        onSearchFilterChange?.(trimmed === '' ? undefined : trimmed);
      }, SEARCH_DEBOUNCE_MS);
    },
    [onSearchFilterChange]
  );

  // Live panel-id → title map. Powers the rename-resilient render of
  // `#panel` mention chips in PulseRenderer, so a renamed panel
  // immediately reflects across every thread instead of leaving the
  // historical name baked into every existing pulse.
  const panelTitlesById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of panels ?? []) {
      map.set(p.id, p.title);
    }
    return map;
  }, [panels]);

  // Polling fallback when Live is unavailable. Refetches every 15s; live
  // events will invalidate sooner. RTK dedupes within the cache.
  useGetResourceVersionQuery(
    { resourceKind: 'dashboard', resourceUID },
    { pollingInterval: 15_000, skip: !resourceUID }
  );

  useResourcePulseStream({ resourceKind: 'dashboard', resourceUID, enabled: !!resourceUID });

  // Facet sources for the filter dropdowns. Both queries dedupe on
  // their resource cache key so we can call them at the drawer level
  // without worrying about wasteful round-trips when other Pulse UI
  // (the title-bar icons) already requested the same data.
  const { data: panelMentionsData } = useListPanelMentionsQuery(
    { resourceKind: 'dashboard', resourceUID },
    { skip: !resourceUID }
  );
  const { data: participantsData } = useListParticipantsQuery(
    { resourceKind: 'dashboard', resourceUID },
    { skip: !resourceUID }
  );

  const panelOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const opts: Array<ComboboxOption<string>> = [
      { value: FILTER_ALL, label: t('pulse.drawer.filter-panel-all', 'All panels') },
    ];
    for (const m of panelMentionsData?.mentions ?? []) {
      // Resolve the live panel title from the dashboard scene's panel
      // map; fall back to the historical title saved on the latest
      // thread, then to "Panel #N" so the dropdown is never blank.
      const title =
        panelTitlesById.get(m.panelId) ??
        m.latestThreadTitle ??
        t('pulse.drawer.filter-panel-fallback', 'Panel #{{id}}', { id: m.panelId });
      opts.push({ value: String(m.panelId), label: `#${title}` });
    }
    return opts;
  }, [panelMentionsData, panelTitlesById]);

  const userOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const opts: Array<ComboboxOption<string>> = [
      { value: FILTER_ALL, label: t('pulse.drawer.filter-user-all', 'All users') },
    ];
    for (const p of participantsData?.participants ?? []) {
      const label =
        p.name?.trim() || p.login?.trim() || t('pulse.drawer.filter-user-fallback', 'User #{{id}}', { id: p.userId });
      opts.push({ value: String(p.userId), label });
    }
    return opts;
  }, [participantsData]);

  const onPanelSelect = useCallback(
    (option: ComboboxOption<string>) => {
      // The "All" sentinel encodes the cleared state as a regular
      // option value rather than relying on isClearable, which would
      // show an X glyph users could miss when the dropdown already
      // includes a labelled "All" row.
      if (option.value === FILTER_ALL) {
        onPanelFilterChange?.(undefined);
        return;
      }
      const id = parseInt(option.value, 10);
      onPanelFilterChange?.(Number.isNaN(id) ? undefined : id);
    },
    [onPanelFilterChange]
  );

  const onUserSelect = useCallback(
    (option: ComboboxOption<string>) => {
      if (option.value === FILTER_ALL) {
        onAuthorFilterChange?.(undefined);
        return;
      }
      const id = parseInt(option.value, 10);
      onAuthorFilterChange?.(Number.isNaN(id) ? undefined : id);
    },
    [onAuthorFilterChange]
  );

  const hasFilters =
    panelFilter !== undefined ||
    authorFilter !== undefined ||
    (searchFilter !== undefined && searchFilter.trim() !== '');

  const { data, isLoading } = useListThreadsQuery({
    resourceKind: 'dashboard',
    resourceUID,
    panelId: panelFilter,
    authorUserId: authorFilter,
    q: searchFilter,
    page: currentPage,
    limit: THREADS_PAGE_SIZE,
  });

  // Backend returns the total once it's known; derive the page count
  // from it so the pager can render numbered buttons up-front. We
  // clamp to at least 1 to avoid Pagination's 0-page edge case when
  // the list is empty.
  const totalCount = data?.totalCount ?? 0;
  const numberOfPages = Math.max(1, Math.ceil(totalCount / THREADS_PAGE_SIZE));

  // Defensive: a delete on the last page can leave us pointing past
  // the end of the result set. Snap back to the new last page so the
  // list isn't stranded blank between fetches.
  useEffect(() => {
    if (currentPage > numberOfPages) {
      setCurrentPage(numberOfPages);
    }
  }, [currentPage, numberOfPages]);

  const [createThread, createThreadState] = useCreateThreadMutation();
  const triggerAssistantReply = useAssistantAutoReply();

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
          panelTitlesById={panelTitlesById}
          resourceMentions={resourceMentions}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          panelFilter={panelFilter}
          currentTimeRange={currentTimeRange}
          onTimeChipClick={onTimeChipClick}
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
            {t('pulse.drawer.start-on-dashboard', 'Start a thread on this dashboard')}
          </Text>
          <PulseComposer
            panels={panels}
            resourceMentions={resourceMentions}
            autoFocus
            pending={createThreadState.isLoading}
            currentUserId={currentUserId}
            currentTimeRange={currentTimeRange}
            showTitle
            titlePlaceholder={t(
              'pulse.drawer.thread-title-placeholder',
              'Title — short summary of this thread (required)'
            )}
            onCancel={() => setComposing(false)}
            onSubmit={async (body, title) => {
              const res = await createThread({
                resourceKind: 'dashboard',
                resourceUID,
                // Filters narrow the *view* of existing threads but
                // never anchor a brand-new thread to a panel — the
                // user can mention `#panel:N` explicitly if they want
                // to associate it. This keeps the affordance honest
                // (filter ≠ scope) and avoids surprise anchoring.
                title,
                body,
              }).unwrap();
              setComposing(false);
              // Snap back to page 1 so the user lands on the list
              // that now includes their new thread (it sorts to the
              // top by last_pulse_at) rather than being stranded on
              // a deeper page that no longer makes sense.
              setCurrentPage(1);
              setActiveThreadUID(res.thread.uid);
              // If the opening pulse tagged @assistant, generate and post
              // the assistant's reply in the background. Pass the dashboard
              // so the assistant gets a link it can open; the panel (if any)
              // is derived from a `#panel` chip in the body by the hook.
              void triggerAssistantReply(body, {
                threadUID: res.thread.uid,
                parentUID: res.pulse.uid,
                dashboardUID: resourceUID,
                // So a #panel chip in the opening pulse names the panel by
                // its current title in the assistant prompt.
                panelTitlesById,
                // When Pulse was opened scoped to a panel, tell the assistant
                // which panel — even without an explicit #panel chip. This
                // informs the prompt only; it does not anchor the thread.
                fallbackPanelId: panelFilter,
              });
            }}
          />
        </Stack>
      </Box>
    );
  }

  const panelSelectValue = panelFilter !== undefined ? String(panelFilter) : FILTER_ALL;
  const userSelectValue = authorFilter !== undefined ? String(authorFilter) : FILTER_ALL;
  const showFilteredEmpty = !isLoading && (data?.items.length ?? 0) === 0 && hasFilters;
  const showUnfilteredEmpty = !isLoading && (data?.items.length ?? 0) === 0 && !hasFilters;

  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        <Field className={styles.searchField} label={t('pulse.drawer.filter-search-label', 'Search threads')} noMargin>
          <Input
            value={searchDraft}
            onChange={onSearchInput}
            placeholder={t('pulse.drawer.filter-search-placeholder', 'Search title or body — matches replies too')}
            prefix={<Icon name="search" />}
            aria-label={t('pulse.drawer.filter-search-aria', 'Filter threads by text')}
          />
        </Field>
        <Stack direction="row" gap={1} alignItems="flex-end" wrap="wrap">
          <Field className={styles.filterField} label={t('pulse.drawer.filter-panel-label', 'Panel')} noMargin>
            <Combobox
              value={panelSelectValue}
              options={panelOptions}
              onChange={onPanelSelect}
              aria-label={t('pulse.drawer.filter-panel-aria', 'Filter threads by panel')}
            />
          </Field>
          <Field className={styles.filterField} label={t('pulse.drawer.filter-user-label', 'User')} noMargin>
            <Combobox
              value={userSelectValue}
              options={userOptions}
              onChange={onUserSelect}
              aria-label={t('pulse.drawer.filter-user-aria', 'Filter threads by user')}
            />
          </Field>
          {hasFilters && (
            <Button size="sm" variant="secondary" fill="text" onClick={() => onClearFilters?.()}>
              {t('pulse.drawer.filter-clear', 'Clear filters')}
            </Button>
          )}
        </Stack>
        <Stack justifyContent="space-between" alignItems="center">
          <Text element="h3" weight="medium">
            {t('pulse.drawer.threads-on-dashboard', 'Threads on this dashboard')}
          </Text>
          <Button size="sm" icon="plus" onClick={() => setComposing(true)}>
            {t('pulse.drawer.new-thread', 'Start a thread')}
          </Button>
        </Stack>
        {isLoading && <LoadingPlaceholder text={t('pulse.drawer.loading', 'Loading threads…')} />}
        {showFilteredEmpty && (
          <EmptyState
            variant="not-found"
            message={t('pulse.drawer.empty-filtered-title', 'No threads match the current filters')}
            button={
              <Button variant="secondary" onClick={() => onClearFilters?.()}>
                {t('pulse.drawer.empty-filtered-cta', 'Clear filters')}
              </Button>
            }
          >
            <Trans i18nKey="pulse.drawer.empty-filtered-body">
              Try a different panel or user, or clear the filters to see every thread on this dashboard.
            </Trans>
          </EmptyState>
        )}
        {showUnfilteredEmpty && (
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
            <ThreadCard
              key={t.uid}
              thread={t}
              panelTitlesById={panelTitlesById}
              onTimeChipClick={onTimeChipClick}
              onClick={() => setActiveThreadUID(t.uid)}
            />
          ))}
        </div>
        {/*
          Numbered pager. `hideWhenSinglePage` collapses to nothing
          when only page 1 exists, so the empty-state and small-list
          flows stay clean. The active page renders in primary
          (blue) by Pagination's own logic — no extra styling
          required to match the user's "highlight current in blue"
          ask. Container styles below keep the pager centered with
          some breathing room from the list above.
        */}
        <div className={styles.pagination}>
          <Pagination
            currentPage={currentPage}
            numberOfPages={numberOfPages}
            onNavigate={(page) => setCurrentPage(page)}
            hideWhenSinglePage
          />
        </div>
      </Stack>
    </Box>
  );
}

interface ThreadCardProps {
  thread: PulseThread;
  panelTitlesById?: ReadonlyMap<number, string>;
  onTimeChipClick?: (from: number, to: number) => void;
  onClick: () => void;
}

function ThreadCard({ thread, panelTitlesById, onTimeChipClick, onClick }: ThreadCardProps): ReactNode {
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
          {thread.previewBody ? (
            <PulseRenderer
              body={thread.previewBody}
              panelTitlesById={panelTitlesById}
              dashboardUID={thread.resourceUID}
              onTimeChipClick={onTimeChipClick}
            />
          ) : (
            headingFallback
          )}
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
  // Each filter Field grows to share row width 50/50; small minimum so
  // long panel titles can still wrap into the dropdown without
  // collapsing the dropdown's hit area below something usable on
  // narrow viewports.
  filterField: css({
    flex: '1 1 0',
    minWidth: theme.spacing(20),
    marginBottom: 0,
  }),
  // Search field spans the full row above the dropdowns. Margin is
  // owned by the parent Stack's gap so the field itself stays flush.
  searchField: css({
    width: '100%',
    marginBottom: 0,
  }),
  // Pagination centers itself within this wrapper so the numbered
  // buttons sit balanced under the list rather than left-aligned
  // against the card edge. We don't use Stack here because
  // Pagination already manages its own internal flex layout.
  pagination: css({
    display: 'flex',
    justifyContent: 'center',
    paddingTop: theme.spacing(1),
  }),
  // Closed threads get a pill that visually breaks from the row's
  // running prose so it reads as state rather than as more metadata.
  // The lock icon reinforces the affordance and matches the lock /
  // unlock IconButtons used inside the thread view.
  //
  // Uses an outlined neutral palette (border + secondary text) instead
  // of the warning palette so the pill never collides visually with
  // `#panel` mention chips, which themselves render in warning colour
  // inside the preview.
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
