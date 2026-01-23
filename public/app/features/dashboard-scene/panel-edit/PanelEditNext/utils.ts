import { SceneDataTransformer, VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { QueryEditorType } from './constants';

export function getQueryType(panel: VizPanel, query?: DataQuery): QueryEditorType {
  if (query && isExpressionQuery(query)) {
    return QueryEditorType.Expression;
  }

  // Check if panel has transformations
  const dataProvider = panel.state.$data;
  if (dataProvider instanceof SceneDataTransformer && dataProvider.state.transformations?.length) {
    return QueryEditorType.Transformation;
  }

  return QueryEditorType.Query;
}
