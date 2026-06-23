import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { Button, EmptyState, Stack } from '@grafana/ui';

import { trackAddQuery } from '../tracking';

import { useActionsContext, useQueryEditorUIContext } from './QueryEditorContext';

/**
 * Shown when a panel has no queries and no transformations — e.g. after the user deletes every
 * sidebar card. Offers a direct way back by adding (and selecting) a new query, mirroring the
 * sidebar's "Add query" action.
 */
export function QueriesEmptyState() {
  const { addQuery } = useActionsContext();
  const { setSelectedQuery } = useQueryEditorUIContext();

  const handleAddQuery = useCallback(() => {
    const refId = addQuery();
    if (refId) {
      trackAddQuery('new_query', 'empty_state');
      setSelectedQuery({ refId, hide: false });
    }
  }, [addQuery, setSelectedQuery]);

  return (
    <Stack alignItems="center" justifyContent="center" flex={1}>
      <EmptyState
        variant="call-to-action"
        message={t(
          'query-editor-next.queries-empty-state.message',
          'Add a query, expression, or transformation to get started'
        )}
        button={
          <Button icon="plus" onClick={handleAddQuery}>
            {t('query-editor-next.queries-empty-state.add-query', 'Add query')}
          </Button>
        }
      />
    </Stack>
  );
}
