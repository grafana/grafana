import {
  functionRendererLeft,
  getPromAndLokiOperationDisplayName,
} from '../../prometheus/querybuilder/shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  VisualQueryModeller,
} from '../../prometheus/querybuilder/shared/types';
import { LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

export function getOperationDefintions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    createRangeOperation('rate'),
    createRangeOperation('count_over_time'),
    createRangeOperation('bytes_rate'),
    createRangeOperation('bytes_over_time'),
    createRangeOperation('absent_over_time'),
    createAggregationOperation('sum'),
    createAggregationOperation('avg'),
    createAggregationOperation('min'),
    createAggregationOperation('max'),
    {
      id: 'json',
      name: 'Json',
      params: [],
      defaultParams: [],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
    },
    {
      id: 'logfmt',
      name: 'Logfmt',
      params: [],
      defaultParams: [],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
    },
    {
      id: '__line_contains',
      name: 'Line contains',
      params: [{ name: 'String', type: 'string' }],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('|='),
      addOperationHandler: addLokiOperation,
    },
    {
      id: '__line_contains_not',
      name: 'Line does not contain',
      params: [{ name: 'String', type: 'string' }],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('!='),
      addOperationHandler: addLokiOperation,
    },
    {
      id: '__line_matches_regex',
      name: 'Line contains regex match',
      params: [{ name: 'Regex', type: 'string' }],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('|~'),
      addOperationHandler: addLokiOperation,
    },
    {
      id: '__line_matches_regex_not',
      name: 'Line does not match regex',
      params: [{ name: 'Regex', type: 'string' }],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('!~'),
      addOperationHandler: addLokiOperation,
    },
    {
      id: '__label_filter',
      name: 'Label filter expression',
      params: [
        { name: 'Label', type: 'string' },
        { name: 'Operator', type: 'string', options: ['=', '!=', '>', '<', '>=', '<='] },
        { name: 'Value', type: 'string' },
      ],
      defaultParams: ['', '=', ''],
      category: LokiVisualQueryOperationCategory.LabelFilters,
      renderer: labelFilterRenderer,
      addOperationHandler: addLokiOperation,
    },
  ];

  return list;
}

function createRangeOperation(name: string): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromAndLokiOperationDisplayName(name),
    params: [getRangeVectorParamDef()],
    defaultParams: ['auto'],
    alternativesKey: 'range function',
    category: LokiVisualQueryOperationCategory.RangeFunctions,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: addLokiOperation,
  };
}

function createAggregationOperation(name: string): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromAndLokiOperationDisplayName(name),
    params: [],
    defaultParams: [],
    alternativesKey: 'plain aggregation',
    category: LokiVisualQueryOperationCategory.Aggregations,
    renderer: functionRendererLeft,
    addOperationHandler: addLokiOperation,
  };
}

function getRangeVectorParamDef(): QueryBuilderOperationParamDef {
  return {
    name: 'Range vector',
    type: 'string',
    options: ['auto', '$__interval', '$__range', '1m', '5m', '10m', '1h', '24h'],
  };
}

function operationWithRangeVectorRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  let rangeVector = (model.params ?? [])[0] ?? 'auto';

  if (rangeVector === 'auto') {
    rangeVector = '$__interval';
  }

  return `${def.id}(${innerExpr} [${rangeVector}])`;
}

function getLineFilterRenderer(operation: string) {
  return function lineFilterRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    if (model.params[0] === '') {
      return innerExpr;
    }
    return `${innerExpr} ${operation} \`${model.params[0]}\``;
  };
}

function labelFilterRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  if (model.params[0] === '') {
    return innerExpr;
  }

  if (model.params[1] === '<' || model.params[1] === '>') {
    return `${innerExpr} | ${model.params[0]} ${model.params[1]} ${model.params[2]}`;
  }

  return `${innerExpr} | ${model.params[0]}${model.params[1]}"${model.params[2]}"`;
}

function pipelineRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  return `${innerExpr} | ${model.id}`;
}

function isRangeVectorFunction(def: QueryBuilderOperationDef) {
  return def.category === LokiVisualQueryOperationCategory.RangeFunctions;
}

function getIndexOfOrLast(
  operations: QueryBuilderOperation[],
  queryModeller: VisualQueryModeller,
  condition: (def: QueryBuilderOperationDef) => boolean
) {
  const index = operations.findIndex((x) => {
    return condition(queryModeller.getOperationDef(x.id));
  });

  return index === -1 ? operations.length : index;
}

export function addLokiOperation(
  def: QueryBuilderOperationDef,
  query: LokiVisualQuery,
  modeller: VisualQueryModeller
): LokiVisualQuery {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  const operations = [...query.operations];

  switch (def.category) {
    case LokiVisualQueryOperationCategory.Aggregations:
    case LokiVisualQueryOperationCategory.Functions: {
      const rangeVectorFunction = operations.find((x) => {
        return isRangeVectorFunction(modeller.getOperationDef(x.id));
      });

      // If we are adding a function but we have not range vector function yet add one
      if (!rangeVectorFunction) {
        const placeToInsert = getIndexOfOrLast(
          operations,
          modeller,
          (def) => def.category === LokiVisualQueryOperationCategory.Functions
        );
        operations.splice(placeToInsert, 0, { id: 'rate', params: ['auto'] });
      }

      operations.push(newOperation);
      break;
    }
    case LokiVisualQueryOperationCategory.RangeFunctions:
      // Add range functions after any formats, line filters and label filters
      const placeToInsert = getIndexOfOrLast(operations, modeller, (x) => {
        return (
          x.category !== LokiVisualQueryOperationCategory.Formats &&
          x.category !== LokiVisualQueryOperationCategory.LineFilters &&
          x.category !== LokiVisualQueryOperationCategory.LabelFilters
        );
      });
      operations.splice(placeToInsert, 0, newOperation);
      break;
    case LokiVisualQueryOperationCategory.Formats:
    case LokiVisualQueryOperationCategory.LineFilters: {
      const placeToInsert = getIndexOfOrLast(operations, modeller, (x) => {
        return x.category !== LokiVisualQueryOperationCategory.LineFilters;
      });
      operations.splice(placeToInsert, 0, newOperation);
      break;
    }
    case LokiVisualQueryOperationCategory.LabelFilters: {
      const placeToInsert = getIndexOfOrLast(operations, modeller, (x) => {
        return (
          x.category !== LokiVisualQueryOperationCategory.LineFilters &&
          x.category !== LokiVisualQueryOperationCategory.Formats
        );
      });
      operations.splice(placeToInsert, 0, newOperation);
    }
  }

  return {
    ...query,
    operations,
  };
}
