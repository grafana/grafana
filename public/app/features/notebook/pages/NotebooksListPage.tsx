import { useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { Alert, Box, Button, Combobox, EmptyState, FilterInput, Stack, Text } from '@grafana/ui';
import { useCreateNotebookMutation } from 'app/api/clients/dashboard/v2beta1';
import { extractErrorMessage, handleError } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';
import { contextSrv } from 'app/core/services/context_srv';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types/accessControl';

import { NotebooksTable } from '../list/NotebooksTable';
import { useNotebooksList } from '../list/useNotebooksList';
// Notebook schema types come from this module and nowhere else, so the eventual stable-v2
// migration only has to change that one seam.
import { defaultSpec as defaultNotebookSpec } from '../types';
import { notebookViewUrl } from '../urls';

const ALL_AUTHORS = '';

export function NotebooksListPage() {
  // The route is registered unconditionally (getAppRoutes is not a React component), so the
  // feature flag is enforced here. When it is off this is not a real route, so render not-found.
  const notebooksEnabled = useFlagDashboardNotebooks();
  const canCreate = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
  const navigate = useNavigate();

  const {
    rows,
    totalCount,
    isTruncated,
    authorOptions,
    searchQuery,
    setSearchQuery,
    authorFilter,
    setAuthorFilter,
    isLoading,
    error,
  } = useNotebooksList({ enabled: notebooksEnabled });

  const [createNotebook] = useCreateNotebookMutation();
  const [isCreating, setIsCreating] = useState(false);

  if (!notebooksEnabled) {
    return <PageNotFound />;
  }

  const onCreate = async () => {
    setIsCreating(true);
    try {
      const created = await createNotebook({
        notebook: {
          metadata: { generateName: 'nb' },
          spec: {
            ...defaultNotebookSpec(),
            // The schema and generated-client element unions are structurally identical but
            // nominally distinct; a new notebook has no elements, so state that here rather
            // than casting the whole spec across the seam.
            elements: {},
            title: t('notebooks.list.new-notebook-title', 'New notebook'),
          },
        },
      }).unwrap();

      if (created.metadata.name) {
        navigate(notebookViewUrl(created.metadata.name));
      } else {
        // The notebook was persisted but we have nowhere to send the user, so say so rather than
        // leaving the click looking like it did nothing.
        handleError(created, dispatch, t('notebooks.list.create-error', 'Failed to create notebook'));
      }
    } catch (e) {
      handleError(e, dispatch, t('notebooks.list.create-error', 'Failed to create notebook'));
    } finally {
      setIsCreating(false);
    }
  };

  const createButton = canCreate ? (
    <Button icon="plus" onClick={onCreate} disabled={isCreating}>
      <Trans i18nKey="notebooks.list.new-notebook">New notebook</Trans>
    </Button>
  ) : undefined;

  const hasNoNotebooks = !isLoading && !error && totalCount === 0;

  return (
    // When nothing exists the empty state carries the create button, so drop it from the header.
    <Page navId="notebooks" actions={hasNoNotebooks ? undefined : createButton}>
      <Page.Contents isLoading={isLoading}>
        <Stack direction="column" gap={2}>
          {/* On a load failure the alert is the whole story — filters over nothing would just add noise. */}
          {error ? (
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
              <Stack justifyContent="space-between" alignItems="center" gap={2} wrap="wrap">
                <Stack alignItems="center" gap={1} wrap="wrap">
                  {/* Without an explicit width FilterInput fills the row and pushes the author
                      filter onto the next line. */}
                  <FilterInput
                    width={40}
                    value={searchQuery}
                    onChange={setSearchQuery}
                    escapeRegex={false}
                    placeholder={t('notebooks.list.search-placeholder', 'Search notebooks by title...')}
                  />
                  <Combobox
                    id="notebooks-author-filter"
                    minWidth={22}
                    width="auto"
                    value={authorFilter}
                    options={[
                      { value: ALL_AUTHORS, label: t('notebooks.list.all-authors', 'All authors') },
                      ...authorOptions,
                    ]}
                    onChange={(option) => setAuthorFilter(option?.value ?? ALL_AUTHORS)}
                    aria-label={t('notebooks.list.author-filter', 'Filter by author')}
                  />
                </Stack>
                {/* Two separate numbers: how many match the filters, and — when the server had
                    more — how many were loaded at all. Filtering runs over the loaded page, so
                    folding them into one count would misreport both. */}
                <Stack alignItems="center" gap={1}>
                  {isTruncated && (
                    <Text variant="bodySmall" color="secondary">
                      {t('notebooks.list.count-truncated', '', {
                        count: totalCount,
                        defaultValue_one: 'First {{count}} notebook loaded',
                        defaultValue_other: 'First {{count}} notebooks loaded',
                      })}
                    </Text>
                  )}
                  <Text variant="bodySmall" color="secondary">
                    {t('notebooks.list.count', '', {
                      count: rows.length,
                      defaultValue_one: '{{count}} notebook',
                      defaultValue_other: '{{count}} notebooks',
                    })}
                  </Text>
                </Stack>
              </Stack>

              {rows.length === 0 ? (
                <Box paddingTop={2}>
                  <EmptyState variant="not-found" message={t('notebooks.list.no-results', 'No notebooks found')} />
                </Box>
              ) : (
                <NotebooksTable notebooks={rows} />
              )}
            </>
          )}
        </Stack>
      </Page.Contents>
    </Page>
  );
}

export default NotebooksListPage;
