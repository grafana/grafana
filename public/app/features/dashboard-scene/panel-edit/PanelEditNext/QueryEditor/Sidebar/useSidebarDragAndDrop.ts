import { DropResult } from '@hello-pangea/dnd';
import { useCallback } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { useActionsContext, useDatasourceContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { Transformation } from '../types';

interface UseSidebarDragAndDropArgs {
  queries: DataQuery[];
  transformations: Transformation[];
}

export function useSidebarDragAndDrop({ queries, transformations }: UseSidebarDragAndDropArgs) {
  const { dsSettings } = useDatasourceContext();
  const { updateQueries, reorderTransformations } = useActionsContext();
  const { setSelectedQuery, setSelectedTransformation } = useQueryEditorUIContext();

  const onQueryDragStart = useCallback(() => {
    reportInteraction('query_row_reorder_started', {
      numberOfQueries: queries.length,
      datasourceType: dsSettings?.type,
    });
  }, [queries.length, dsSettings?.type]);

  const onQueryDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      const startIndex = result.source.index;
      const endIndex = result.destination.index;

      if (startIndex === endIndex) {
        reportInteraction('query_row_reorder_canceled', {
          startIndex,
          endIndex,
          numberOfQueries: queries.length,
          datasourceType: dsSettings?.type,
        });
        return;
      }

      const draggedQuery = queries[startIndex];
      const reordered = Array.from(queries);
      const [removed] = reordered.splice(startIndex, 1);
      reordered.splice(endIndex, 0, removed);
      updateQueries(reordered);
      setSelectedQuery(draggedQuery);

      reportInteraction('query_row_reorder_ended', {
        startIndex,
        endIndex,
        numberOfQueries: queries.length,
        datasourceType: dsSettings?.type,
      });
    },
    [queries, updateQueries, setSelectedQuery, dsSettings?.type]
  );

  const onTransformationDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      const startIndex = result.source.index;
      const endIndex = result.destination.index;

      if (startIndex === endIndex) {
        return;
      }

      const draggedTransformation = transformations[startIndex];
      const reordered = Array.from(transformations);
      const [removed] = reordered.splice(startIndex, 1);
      reordered.splice(endIndex, 0, removed);
      reorderTransformations(reordered.map((t) => t.transformConfig));
      // transformId is index-based (see useTransformations), so use the new index
      setSelectedTransformation({
        ...draggedTransformation,
        transformId: `${draggedTransformation.transformConfig.id}-${endIndex}`,
      });
    },
    [transformations, reorderTransformations, setSelectedTransformation]
  );

  return { onQueryDragStart, onQueryDragEnd, onTransformationDragEnd };
}
