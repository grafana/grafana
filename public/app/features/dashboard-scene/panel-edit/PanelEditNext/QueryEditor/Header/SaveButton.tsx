import { RefObject, useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { QueryEditorType } from '../../constants';
import { useActionsContext, useDatasourceContext, useQueryEditorUIContext } from '../QueryEditorContext';

interface SaveButtonProps {
  // Ref to the parent container for positioning/formatting the saved queries dropdown
  parentRef?: RefObject<HTMLDivElement>;
}

// TODO: Confirm this works as expected once we get the query content work completed
export function SaveButton({ parentRef }: SaveButtonProps) {
  const { datasource } = useDatasourceContext();
  const { queryLibraryEnabled, renderSavedQueryButtons, isEditingQuery, setIsEditingQuery } = useQueryLibraryContext();
  const { selectedQuery, setSelectedQuery, cardType } = useQueryEditorUIContext();
  const { updateSelectedQuery, runQueries } = useActionsContext();

  const onUpdateSuccess = useCallback(() => {
    // Exit query library editing mode after successful save
    setIsEditingQuery(false);
  }, [setIsEditingQuery]);

  // Callback when user selects a query from the library
  const onSelectQuery = useCallback(
    (query: DataQuery) => {
      if (!selectedQuery) {
        return;
      }

      // Replace the current query with the library query, preserving refId
      const originalRefId = selectedQuery.refId;
      updateSelectedQuery(
        {
          ...query,
          refId: originalRefId, // Keep the original refId
        },
        originalRefId
      );

      // Update selected query to the new query
      setSelectedQuery({ ...query, refId: originalRefId });

      // Run queries with the new query from library
      runQueries();
    },
    [selectedQuery, updateSelectedQuery, setSelectedQuery, runQueries]
  );

  // Only queries can be saved to library (expressions/transformations can't)
  if (cardType !== QueryEditorType.Query) {
    return null;
  }

  // Don't show if query library feature is disabled or no selected query
  if (!queryLibraryEnabled || !selectedQuery) {
    return null;
  }

  // Don't show when editing a query from the library
  if (isEditingQuery) {
    return null;
  }

  return renderSavedQueryButtons(
    {
      ...selectedQuery,
      datasource: datasource ? { uid: datasource.uid, type: datasource.type } : selectedQuery.datasource,
    },
    CoreApp.PanelEditor,
    onUpdateSuccess,
    onSelectQuery,
    undefined,
    parentRef
  );
}
