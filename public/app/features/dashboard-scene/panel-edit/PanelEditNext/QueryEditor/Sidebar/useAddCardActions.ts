import { useCallback } from 'react';

import { type DataQuery } from '@grafana/schema';

import { type AddCardSource, trackAddQuery, trackAddTransformationInitiated } from '../../tracking';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

export function getCardSource(afterId?: string): AddCardSource {
  return afterId ? 'inline' : 'section_header';
}

export function useAddAndSelectQuery(afterId?: string, onAdd?: () => void) {
  const { addQuery } = useActionsContext();
  const { setSelectedQuery } = useQueryEditorUIContext();

  return useCallback(
    (query?: Partial<DataQuery>) => {
      const newRefId = addQuery(query, afterId);
      if (newRefId) {
        setSelectedQuery({ refId: newRefId, hide: false });
        onAdd?.();
      }
    },
    [addQuery, afterId, setSelectedQuery, onAdd]
  );
}

export function useAddNewQuery(afterId?: string, onAdd?: () => void, source: AddCardSource = getCardSource(afterId)) {
  const addAndSelectQuery = useAddAndSelectQuery(afterId, onAdd);

  return useCallback(() => {
    trackAddQuery('new_query', source);
    addAndSelectQuery();
  }, [source, addAndSelectQuery]);
}

export function useAddTransformation(
  afterId?: string,
  onAdd?: () => void,
  source: AddCardSource = getCardSource(afterId)
) {
  const { setPendingTransformation } = useQueryEditorUIContext();

  return useCallback(() => {
    trackAddTransformationInitiated(source);
    setPendingTransformation({ insertAfter: afterId });
    onAdd?.();
  }, [afterId, setPendingTransformation, onAdd, source]);
}
