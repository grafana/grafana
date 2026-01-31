import { RefObject, useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { QueryEditorType } from '../../constants';
import { useActionsContext, useDatasourceContext, useQueryEditorUIContext } from '../QueryEditorContext';

interface SaveButtonProps {
  cardType: QueryEditorType;
  // Ref to the parent container for positioning/formatting the saved queries dropdown
  parentRef?: RefObject<HTMLDivElement>;
}

// TODO: Confirm this works as expected once we get the query content work completed
export function SaveButton({ cardType, parentRef }: SaveButtonProps) {
  const { datasource } = useDatasourceContext();
  const { queryLibraryEnabled, renderSavedQueryButtons, isEditingQuery, setIsEditingQuery } = useQueryLibraryContext();
  const { selectedCard, setSelectedCard } = useQueryEditorUIContext();
  const { updateSelectedQuery, runQueries } = useActionsContext();

  const onUpdateSuccess = useCallback(() => {
    // Exit query library editing mode after successful save
    setIsEditingQuery(false);
  }, [setIsEditingQuery]);

  // Callback when user selects a query from the library
  const onSelectQuery = useCallback(
    (query: DataQuery) => {
      if (!selectedCard) {
        return;
      }

      // Replace the current query with the library query, preserving refId
      const originalRefId = selectedCard.refId;
      updateSelectedQuery(
        {
          ...query,
          refId: originalRefId, // Keep the original refId
        },
        originalRefId
      );

      // Update selected card to the new query
      setSelectedCard({ ...query, refId: originalRefId });

      // Run queries with the new query from library
      runQueries();
    },
    [selectedCard, updateSelectedQuery, setSelectedCard, runQueries]
  );

  // Only queries can be saved to library (expressions/transformations can't)
  if (cardType !== QueryEditorType.Query) {
    return null;
  }

  // Don't show if query library feature is disabled or no selected card
  if (!queryLibraryEnabled || !selectedCard) {
    return null;
  }

  // Don't show when editing a query from the library
  if (isEditingQuery) {
    return null;
  }

  return (
    <>
      {renderSavedQueryButtons(
        {
          ...selectedCard,
          datasource: datasource ? { uid: datasource.uid, type: datasource.type } : selectedCard.datasource,
        },
        CoreApp.PanelEditor,
        onUpdateSuccess,
        onSelectQuery,
        undefined,
        parentRef
      )}
    </>
  );
}
