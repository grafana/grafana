import { DropResult } from '@hello-pangea/dnd';
import { useCallback } from 'react';

import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';
import { getTransformId } from '../utils';

function getDropIndices(result: DropResult): { startIndex: number; endIndex: number } | null {
  if (!result.destination || result.source.index === result.destination.index) {
    return null;
  }
  return { startIndex: result.source.index, endIndex: result.destination.index };
}

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export function useSidebarDragAndDrop() {
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { updateQueries, reorderTransformations } = useActionsContext();
  const { setActiveContext } = useQueryEditorUIContext();

  const onQueryDragEnd = useCallback(
    (result: DropResult) => {
      const drop = getDropIndices(result);
      if (!drop) {
        return;
      }
      const { startIndex, endIndex } = drop;
      updateQueries(reorder(queries, startIndex, endIndex));
      setActiveContext({ view: 'data', selection: { kind: 'query', refId: queries[startIndex].refId } });
    },
    [queries, updateQueries, setActiveContext]
  );

  const onTransformationDragEnd = useCallback(
    (result: DropResult) => {
      const drop = getDropIndices(result);
      if (!drop) {
        return;
      }
      const { startIndex, endIndex } = drop;
      const draggedTransformation = transformations[startIndex];
      reorderTransformations(reorder(transformations, startIndex, endIndex).map((t) => t.transformConfig));
      setActiveContext({
        view: 'data',
        selection: {
          kind: 'transformation',
          id: getTransformId(draggedTransformation.transformConfig.id, endIndex),
        },
      });
    },
    [transformations, reorderTransformations, setActiveContext]
  );

  return { onQueryDragEnd, onTransformationDragEnd };
}
