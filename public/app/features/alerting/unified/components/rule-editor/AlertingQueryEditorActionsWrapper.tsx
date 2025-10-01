import { useCallback, useState } from 'react';

import { CoreApp, DataSourceInstanceSettings } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Spinner, Stack } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import {
  isAlertingSavedQuerySupported,
  updateAlertQueryFromSavedQuery,
  validateSavedQueryForAlerting,
} from '../../utils/savedQueryUtils';

interface Props {
  query: AlertQuery;
  datasourceInstanceSettings: DataSourceInstanceSettings | undefined;
  onQueryReplace: (query: AlertQuery) => Promise<void> | void;
  showButtons: boolean; // Control when to show buttons
  onlyIcons?: boolean; // Force icon-only display
}

export function AlertingQueryEditorActionsWrapper({
  query,
  datasourceInstanceSettings,
  onQueryReplace,
  showButtons,
  onlyIcons,
}: Props) {
  const { renderSavedQueryButtons } = useQueryLibraryContext();
  const [isReplacing, setIsReplacing] = useState(false);

  const handleAsyncQueryReplace = useCallback(
    async (replacedQuery: DataQuery) => {
      if (isReplacing) {
        return; // Prevent concurrent replacements
      }

      setIsReplacing(true);
      try {
        console.log('=== Query Replacement Started ===');
        console.log('Before replacement - Original AlertQuery:', JSON.stringify(query, null, 2));
        console.log('Saved query to apply (DataQuery):', JSON.stringify(replacedQuery, null, 2));

        // Validate query compatibility (optional but provides user feedback)
        const validation = validateSavedQueryForAlerting(replacedQuery);
        if (validation.warnings.length > 0) {
          console.warn('Query compatibility warnings:', validation.warnings);
        }

        if (!validation.valid) {
          console.error('Query compatibility issues:', validation.issues);
        }

        const updatedAlertQuery = await updateAlertQueryFromSavedQuery(query, replacedQuery);

        console.log('After replacement - Updated AlertQuery:', JSON.stringify(updatedAlertQuery, null, 2));
        console.log('=== Query Replacement Completed ===');

        await onQueryReplace(updatedAlertQuery);
      } catch (error) {
        console.error('Failed to replace query:', error);

        // Show error notification to user
        const errorMessage = error instanceof Error ? error.message : 'Failed to replace query';
        getAppEvents().publish({
          type: 'alert-error',
          payload: [errorMessage],
        });
      } finally {
        setIsReplacing(false);
      }
    },
    [query, onQueryReplace, isReplacing]
  );

  if (!showButtons) {
    return null;
  }

  // Only show saved query buttons for supported datasources (Prometheus, Loki)
  if (datasourceInstanceSettings && !isAlertingSavedQuerySupported(datasourceInstanceSettings.type)) {
    return null;
  }

  // Convert AlertQuery to DataQuery format for SavedQueryButtons display
  const dataQuery: DataQuery = {
    ...query.model,
    datasource: datasourceInstanceSettings
      ? {
          type: datasourceInstanceSettings.type,
          uid: datasourceInstanceSettings.uid,
        }
      : undefined,
  };

  // Filtering is handled by the drawer based on appContext (CoreApp.UnifiedAlerting)
  // No need to pass datasourceFilters here - the drawer will automatically filter to Prometheus/Loki
  const savedQueryButtons = renderSavedQueryButtons(
    dataQuery,
    CoreApp.UnifiedAlerting,
    undefined,
    handleAsyncQueryReplace, // Use async-aware callback
    undefined, // No datasourceFilters - drawer handles filtering based on context
    onlyIcons
  );

  return savedQueryButtons ? (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="flex-end">
        {isReplacing && <Spinner size={16} />}
        {savedQueryButtons}
      </Stack>
    </Stack>
  ) : null;
}
