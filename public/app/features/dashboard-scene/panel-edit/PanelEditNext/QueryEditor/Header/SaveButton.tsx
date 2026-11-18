import { type RefObject, useCallback } from 'react';

import { CoreApp } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

import { type QueryActionTarget } from './headerActionTarget';

interface SaveButtonProps {
  target: QueryActionTarget;
  // Ref to the parent container for positioning/formatting the saved queries dropdown
  parentRef?: RefObject<HTMLDivElement | null>;
}

// TODO: Confirm this works as expected once we get the query content work completed
export function SaveButton({ target, parentRef }: SaveButtonProps) {
  const { queryLibraryEnabled, renderSavedQueryButtons, isEditingQuery, setIsEditingQuery } = useQueryLibraryContext();
  const { setSelectedQuery } = useQueryEditorUIContext();
  const { updateSelectedQuery, addQuery, runQueries } = useActionsContext();
  const { query: targetQuery, cardType, dsData } = target;

  const onUpdateSuccess = useCallback(() => {
    // Exit query library editing mode after successful save
    setIsEditingQuery(false);
  }, [setIsEditingQuery]);

  // Callback when user selects a query from the library
  const onSelectQuery = useCallback(
    (query: DataQuery) => {
      // Replace the target query with the library query, preserving refId
      const originalRefId = targetQuery.refId;
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
    [targetQuery.refId, updateSelectedQuery, setSelectedQuery, runQueries]
  );

  // Callback when the user selects a multi-query entry (e.g. a recent entry that ran several
  // queries together). Replaces the target query in place with the first and inserts the rest
  // right after it, preserving order. The first reuses the original refId; the rest get fresh ones.
  const onSelectQueries = useCallback(
    (queries: DataQuery[]) => {
      if (queries.length === 0) {
        return;
      }

      const originalRefId = targetQuery.refId;
      const [first, ...rest] = queries;

      const replacement = { ...first, refId: originalRefId };
      updateSelectedQuery(replacement, originalRefId);
      setSelectedQuery(replacement);

      // Insert the remaining queries after the replaced one, chaining so order is preserved.
      let afterRefId = originalRefId;
      for (const query of rest) {
        const newRefId = addQuery(query, afterRefId);
        if (newRefId) {
          afterRefId = newRefId;
        }
      }

      runQueries();
    },
    [targetQuery.refId, updateSelectedQuery, setSelectedQuery, addQuery, runQueries]
  );

  // Only queries can be saved to library (expressions/transformations can't)
  if (cardType !== QueryEditorType.Query) {
    return null;
  }

  if (!queryLibraryEnabled) {
    return null;
  }

  // Don't show when editing a query from the library
  if (isEditingQuery) {
    return null;
  }

  const datasource = dsData?.datasource;

  return renderSavedQueryButtons({
    query: {
      ...targetQuery,
      datasource: datasource ? { uid: datasource.uid, type: datasource.type } : targetQuery.datasource,
    },
    app: CoreApp.PanelEditor,
    onUpdateSuccess,
    onSelectQuery,
    parentRef,
    showAsButtonHeader: true,
    onSelectQueries,
  });
}
