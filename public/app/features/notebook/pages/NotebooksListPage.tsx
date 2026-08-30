import Skeleton from 'react-loading-skeleton';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { Alert, Box, Button, Checkbox, EmptyState, FilterInput, Stack, Text } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NotebooksTable, NotebooksTableSkeleton } from '../list/NotebooksTable';
import { useNotebooksList } from '../list/useNotebooksList';
import { notebookNewEditUrl } from '../urls';

export function NotebooksListPage() {
  // The route is registered unconditionally (getAppRoutes is not a React component), so the
  // feature flag is enforced here. When it is off this is not a real route, so render not-found.
  const notebooksEnabled = useFlagDashboardNotebooks();
  const canCreate = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
  const navigate = useNavigate();

  const {
    rows,
    totalCount,
    isTotalExact,
    loadedCount,
    isTruncated,
    isLoadingMore,
    isFiltered,
    searchQuery,
    setSearchQuery,
    createdByMe,
    setCreatedByMe,
    canFilterByMe,
    isLoading,
    isReloading,
    filterKey,
    error,
  } = useNotebooksList({ enabled: notebooksEnabled });

  if (!notebooksEnabled) {
    return <PageNotFound />;
  }

  // Opens a blank notebook rather than writing one. Nothing is created until there is something to
  // save, so a click that goes nowhere leaves no notebook behind in the library.
  const onCreate = () => navigate(notebookNewEditUrl());

  const createButton = canCreate ? (
    <Button icon="plus" onClick={onCreate}>
      <Trans i18nKey="notebooks.list.new-notebook">New notebook</Trans>
    </Button>
  ) : undefined;

  // Filtering happens server-side, so an empty page only means the library is empty when nothing
  // is filtered — otherwise it is a no-results state and the CTA would be wrong. While a new set of
  // filters is loading the rows are empty because nothing has arrived yet, which is neither.
  const hasNoNotebooks = !isLoading && !isReloading && !error && !isFiltered && rows.length === 0;

  /**
   * The cursor is walked page by page, so a failure can land after earlier pages already have. Only
   * a failure with nothing to show is the whole story; otherwise the rows that did load stay, and
   * the alert says some are missing rather than replacing them.
   */
  const isPartialFailure = Boolean(error) && rows.length > 0;

  /**
   * A failure takes over the page only when the reader has nothing to act on. Once filters are
   * engaged they have to stay mounted even with nothing loaded, because the filter that provoked
   * the failure is the one thing worth changing — unmounting it leaves reloading the page as the
   * only way to clear it.
   */
  const isBlockingFailure = Boolean(error) && rows.length === 0 && !isFiltered;

  return (
    // When nothing exists the empty state carries the create button, so drop it from the header.
    <Page navId="notebooks" actions={hasNoNotebooks ? undefined : createButton}>
      <Page.Contents isLoading={isLoading}>
        <Stack direction="column" gap={2}>
          {/* With nothing loaded and nothing filtered the alert is the whole story — filters over
              nothing would just add noise. */}
          {isBlockingFailure ? (
            // Carry the detail through, so a permissions problem reads differently from an outage.
            <Alert severity="error" title={t('notebooks.list.load-error', 'Failed to load notebooks')}>
              {extractErrorMessage(error)}
            </Alert>
          ) : hasNoNotebooks ? (
            <EmptyState
              variant={canCreate ? 'call-to-action' : 'not-found'}
              button={createButton}
              message={
                canCreate
                  ? t('notebooks.list.empty-title', "You haven't created any notebooks yet")
                  : // Someone who cannot create one has nothing to act on, and may simply not have
                    // been given access to any that exist.
                    t('notebooks.list.empty-title-read-only', 'No notebooks available to you')
              }
            >
              {canCreate && (
                <Trans i18nKey="notebooks.list.empty-body">
                  Notebooks capture an investigation as a document: narrative text and code alongside live
                  visualizations from your dashboards, alerts, and incidents.
                </Trans>
              )}
            </EmptyState>
          ) : (
            <>
              {/* Above the filters rather than in place of them, so the query that failed stays
                  editable. A warning when some rows loaded — they are still usable, still on
                  screen below — and an error when none did. */}
              {error && (
                <Alert
                  severity={isPartialFailure ? 'warning' : 'error'}
                  title={
                    isPartialFailure
                      ? t('notebooks.list.partial-load-error', 'Some notebooks could not be loaded')
                      : t('notebooks.list.load-error', 'Failed to load notebooks')
                  }
                >
                  {extractErrorMessage(error)}
                </Alert>
              )}
              <Stack justifyContent="space-between" alignItems="center" gap={2} wrap="wrap">
                <Stack alignItems="center" gap={1} wrap="wrap">
                  {/* Without an explicit width FilterInput fills the row and pushes the author
                      checkbox onto the next line. */}
                  <FilterInput
                    width={40}
                    value={searchQuery}
                    onChange={setSearchQuery}
                    escapeRegex={false}
                    placeholder={t('notebooks.list.search-placeholder', 'Search notebooks by title...')}
                  />
                  {canFilterByMe && (
                    <Checkbox
                      id="notebooks-created-by-me"
                      value={createdByMe}
                      onChange={(event) => setCreatedByMe(event.currentTarget.checked)}
                      label={t('notebooks.list.created-by-me', 'Created by me')}
                    />
                  )}
                </Stack>
                <Stack alignItems="center" gap={1}>
                  {/* Nothing is held for these filters yet, so every number here would be zero —
                      "0 notebooks" beside a loading table claims a result we do not have. */}
                  {isReloading ? (
                    <Skeleton width={COUNT_SKELETON_WIDTH} />
                  ) : (
                    <CountSummary
                      shown={rows.length}
                      loadedCount={loadedCount}
                      totalCount={totalCount}
                      isTotalExact={isTotalExact}
                      isTruncated={isTruncated}
                      isLoadingMore={isLoadingMore}
                    />
                  )}
                </Stack>
              </Stack>

              {/* Rows are empty while new filters load, so a no-results state here would be a lie.
                  The filters stay mounted either way — swapping them out would take the caret with
                  them, mid-typing. */}
              {isReloading ? (
                <NotebooksTableSkeleton />
              ) : rows.length > 0 ? (
                // Keyed by the filters so narrowing the set drops the page index the reader was on,
                // which is the one case the table itself no longer resets for.
                <NotebooksTable key={filterKey} notebooks={rows} />
              ) : (
                // Only when the request answered: after a failure the alert above explains the
                // empty table, and "No notebooks found" would report a result nobody returned.
                !error && (
                  <Box paddingTop={2}>
                    <EmptyState variant="not-found" message={t('notebooks.list.no-results', 'No notebooks found')} />
                  </Box>
                )
              )}
            </>
          )}
        </Stack>
      </Page.Contents>
    </Page>
  );
}

/** About the width of the longest count this can show, so the row does not shift when it resolves. */
const COUNT_SKELETON_WIDTH = 120;

interface CountSummaryProps {
  /** Rows on screen. */
  shown: number;
  /** Rows the request returned, before client-side filtering. */
  loadedCount: number;
  /** Matches the server counted, or undefined when it reports no total. */
  totalCount: number | undefined;
  isTotalExact: boolean;
  isTruncated: boolean;
  /** Pages are still arriving, so every number here is still climbing. */
  isLoadingMore: boolean;
}

/**
 * Says how much of the library is on screen, phrased by what the serving path can honestly claim.
 * Nothing here invents a total: when the server does not report one, the size of the window it
 * returned is all there is to say.
 */
function CountSummary({ shown, loadedCount, totalCount, isTotalExact, isTruncated, isLoadingMore }: CountSummaryProps) {
  const matches = (
    <Text variant="bodySmall" color="secondary">
      {t('notebooks.list.count', '', {
        count: shown,
        defaultValue_one: '{{count}} notebook',
        defaultValue_other: '{{count}} notebooks',
      })}
    </Text>
  );

  // Say so rather than letting the count climb on its own, which reads as a miscount.
  if (isLoadingMore && totalCount !== undefined) {
    return (
      <Text variant="bodySmall" color="secondary">
        {t('notebooks.list.count-loading', 'Loading {{shown}} of {{total}}...', { shown, total: totalCount })}
      </Text>
    );
  }

  if (!isTruncated) {
    return matches;
  }

  // No server-side total: two numbers, because how many were loaded and how many of those matched
  // are different facts, and folding them into one would misreport both.
  if (totalCount === undefined) {
    return (
      <>
        <Text variant="bodySmall" color="secondary">
          {t('notebooks.list.count-truncated', '', {
            count: loadedCount,
            defaultValue_one: 'First {{count}} notebook loaded',
            defaultValue_other: 'First {{count}} notebooks loaded',
          })}
        </Text>
        {matches}
      </>
    );
  }

  return (
    <Text variant="bodySmall" color="secondary">
      {/* `shown` rather than `count`, which would have i18next emit plural variants of a string
          that does not vary. */}
      {isTotalExact
        ? t('notebooks.list.count-of-total', 'Showing {{shown}} of {{total}}', { shown, total: totalCount })
        : // An inexact total is an upper bound, and one counted before per-item authorization at
          // that — so it has to read as a ceiling rather than as "at least this many".
          t('notebooks.list.count-of-total-approx', 'Showing {{shown}} of up to {{total}}', {
            shown,
            total: totalCount,
          })}
    </Text>
  );
}

export default NotebooksListPage;
