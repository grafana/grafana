import { RefObject, useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

interface SaveButtonProps {
  // Ref to the parent container for positioning/formatting the saved queries dropdown
  parentRef?: RefObject<HTMLDivElement>;
}

// TODO: Confirm this works as expected once we get the query content work completed
export function SaveButton({ parentRef }: SaveButtonProps) {
  const { queryLibraryEnabled, renderSavedQueryButtons, isEditingQuery, setIsEditingQuery } = useQueryLibraryContext();
  const { selectedQuery, setActiveContext, selectedQueryDsData } = useQueryEditorUIContext();
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

      // Navigate to the updated query
      setActiveContext({ view: 'data', selection: { kind: 'query', refId: originalRefId } });

      // Run queries with the new query from library
      runQueries();
    },
    [selectedQuery, updateSelectedQuery, setActiveContext, runQueries]
  );

  // Only plain queries can be saved to library (not expressions, transformations, or alerts)
  if (!selectedQuery) {
    return null;
  }

  if (!queryLibraryEnabled) {
    return null;
  }

  // Don't show when editing a query from the library
  if (isEditingQuery) {
    return null;
  }

  const datasource = selectedQueryDsData?.datasource;

  return renderSavedQueryButtons(
    {
      ...selectedQuery,
      datasource: datasource ? { uid: datasource.uid, type: datasource.type } : selectedQuery.datasource,
    },
    CoreApp.PanelEditor,
    onUpdateSuccess,
    onSelectQuery,
    undefined,
    parentRef,
    true
  );
}
