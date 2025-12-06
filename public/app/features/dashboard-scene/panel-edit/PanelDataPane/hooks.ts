import { useMemo } from 'react';

import { DataTransformerConfig } from '@grafana/data';
import { SceneDataQuery } from '@grafana/scenes';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { QueryItem, TransformItem } from './types';
import { isDataTransformerConfig, queryItemId, transformItemId } from './utils';

export function useQueryTransformItems(queries?: SceneDataQuery[], transformations?: DataTransformerConfig[]) {
  const result = useMemo(() => {
    const queryExpressionItems: QueryItem[] = [];
    const transformItems: TransformItem[] = [];

    // Add queries and expressions
    for (let i = 0; i < (queries?.length ?? 0); i++) {
      const query = queries![i];
      queryExpressionItems.push({
        id: queryItemId(query),
        type: isExpressionQuery(query) ? 'expression' : 'query',
        data: query,
        index: i, // Store actual index in queries array
      });
    }

    // Add transformations
    for (let i = 0; i < (transformations?.length ?? 0); i++) {
      const transform = transformations![i];
      if (isDataTransformerConfig(transform)) {
        transformItems.push({
          id: transformItemId(i),
          type: 'transform',
          data: transform,
          index: i,
        });
      }
    }

    return {
      queryExpressionItems,
      transformItems,
      allItems: [...queryExpressionItems, ...transformItems],
    };
  }, [queries, transformations]);

  return result;
}
