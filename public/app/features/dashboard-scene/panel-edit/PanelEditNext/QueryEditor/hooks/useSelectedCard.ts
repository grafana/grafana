import { useMemo } from 'react';

import { DataQuery } from '@grafana/schema';

import { Transformation } from '../types';

/**
 * Hook to resolve the currently selected query or transformation.
 * They are mutually exclusive - if a transformation is selected, no query is selected.
 */
export function useSelectedCard(
  selectedQueryRefId: string | null,
  selectedTransformationId: string | null,
  queries: DataQuery[],
  transformations: Transformation[]
) {
  const selectedQuery = useMemo(() => {
    // If we have a selected query refId, try to find that query
    if (selectedQueryRefId) {
      const query = queries.find((q) => q.refId === selectedQueryRefId);
      if (query) {
        return query;
      }
    }

    // If a transformation is selected, don't select any query
    if (selectedTransformationId) {
      return null;
    }

    // Otherwise, default to the first query if available
    return queries.length > 0 ? queries[0] : null;
  }, [queries, selectedQueryRefId, selectedTransformationId]);

  const selectedTransformation = useMemo(() => {
    // If we have a selected transformation id, try to find that transformation
    if (selectedTransformationId) {
      const transformation = transformations.find((t) => t.transformId === selectedTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, selectedTransformationId]);

  return { selectedQuery, selectedTransformation };
}
