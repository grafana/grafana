import { LabelParamEditor } from '../../prometheus/querybuilder/components/LabelParamEditor';
import {
  getAggregationExplainer,
  getLastLabelRemovedHandler,
  getOnLabelAddedHandler,
  getPromAndLokiOperationDisplayName,
} from '../../prometheus/querybuilder/shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  VisualQueryModeller,
} from '../../prometheus/querybuilder/shared/types';
import { FUNCTIONS } from '../syntax';

import { LokiOperationId, LokiOperationOrder, LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

export function createRangeOperation(name: string, isRangeOperationWithGrouping?: boolean): QueryBuilderOperationDef {
  const params = [getRangeVectorParamDef()];
  const defaultParams = ['$__interval'];
  let paramChangedHandler = undefined;

  if (name === LokiOperationId.QuantileOverTime) {
    defaultParams.push('0.95');
    params.push({
      name: 'Quantile',
      type: 'number',
    });
  }

  if (isRangeOperationWithGrouping) {
    params.push({
      name: 'By label',
      type: 'string',
      restParam: true,
      optional: true,
    });

    paramChangedHandler = getOnLabelAddedHandler(`__${name}_by`);
  }

  return {
    id: name,
    name: getPromAndLokiOperationDisplayName(name),
    params: params,
    defaultParams,
    alternativesKey: 'range function',
    category: LokiVisualQueryOperationCategory.RangeFunctions,
    orderRank: LokiOperationOrder.RangeVectorFunction,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: addLokiOperation,
    paramChangedHandler,
    explainHandler: (op, def) => {
      let opDocs = FUNCTIONS.find((x) => x.insertText === op.id)?.documentation ?? '';

      if (op.params[0] === '$__interval') {
        return `${opDocs} \`$__interval\` is a variable that will be replaced with the [calculated interval](https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#__interval) based on the time range and width of the graph. In Dashboards, you can affect the interval variable using **Max data points** and **Min interval**. You can find these options under **Query options** right of the data source select dropdown.`;
      } else {
        return `${opDocs} The [range vector](https://grafana.com/docs/loki/latest/logql/metric_queries/#range-vector-aggregation) is set to \`${op.params[0]}\`.`;
      }
    },
  };
}

export function createRangeOperationWithGrouping(name: string): QueryBuilderOperationDef[] {
  const rangeOperation = createRangeOperation(name, true);
  // Copy range operation params without the last param
  const params = rangeOperation.params.slice(0, -1);
  const operations: QueryBuilderOperationDef[] = [
    rangeOperation,
    {
      id: `__${name}_by`,
      name: `${getPromAndLokiOperationDisplayName(name)} by`,
      params: [
        ...params,
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: LabelParamEditor,
        },
      ],
      defaultParams: [...rangeOperation.defaultParams, ''],
      alternativesKey: 'range function with grouping',
      category: LokiVisualQueryOperationCategory.RangeFunctions,
      renderer: getRangeAggregationWithGroupingRenderer(name, 'by'),
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'by'),
      addOperationHandler: addLokiOperation,
      hideFromList: true,
    },
    {
      id: `__${name}_without`,
      name: `${getPromAndLokiOperationDisplayName(name)} without`,
      params: [
        ...params,
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: LabelParamEditor,
        },
      ],
      defaultParams: [...rangeOperation.defaultParams, ''],
      alternativesKey: 'range function with grouping',
      category: LokiVisualQueryOperationCategory.RangeFunctions,
      renderer: getRangeAggregationWithGroupingRenderer(name, 'without'),
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'without'),
      addOperationHandler: addLokiOperation,
      hideFromList: true,
    },
  ];

  return operations;
}

export function getRangeAggregationWithGroupingRenderer(aggregation: string, grouping: 'by' | 'without') {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    const restParamIndex = def.params.findIndex((param) => param.restParam);
    const params = model.params.slice(0, restParamIndex);
    const restParams = model.params.slice(restParamIndex);

    if (params.length === 2 && aggregation === LokiOperationId.QuantileOverTime) {
      return `${aggregation}(${params[1]}, ${innerExpr} [${params[0]}]) ${grouping} (${restParams.join(', ')})`;
    }

    return `${aggregation}(${innerExpr} [${params[0]}]) ${grouping} (${restParams.join(', ')})`;
  };
}

function operationWithRangeVectorRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  const params = model.params ?? [];
  const rangeVector = params[0] ?? '$__interval';
  // QuantileOverTime is only range vector with more than one param
  if (params.length === 2 && model.id === LokiOperationId.QuantileOverTime) {
    const quantile = params[1];
    return `${model.id}(${quantile}, ${innerExpr} [${rangeVector}])`;
  }

  return `${model.id}(${innerExpr} [${params[0] ?? '$__interval'}])`;
}

export function labelFilterRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  const integerOperators = ['<', '<=', '>', '>='];

  if (integerOperators.includes(String(model.params[1]))) {
    return `${innerExpr} | ${model.params[0]} ${model.params[1]} ${model.params[2]}`;
  }

  return `${innerExpr} | ${model.params[0]} ${model.params[1]} \`${model.params[2]}\``;
}

export function isConflictingFilter(
  operation: QueryBuilderOperation,
  queryOperations: QueryBuilderOperation[]
): boolean {
  const operationIsNegative = operation.params[1].toString().startsWith('!');

  const candidates = queryOperations.filter(
    (queryOperation) =>
      queryOperation.id === LokiOperationId.LabelFilter &&
      queryOperation.params[0] === operation.params[0] &&
      queryOperation.params[2] === operation.params[2]
  );

  const conflict = candidates.some((candidate) => {
    if (operationIsNegative && candidate.params[1].toString().startsWith('!') === false) {
      return true;
    }
    if (operationIsNegative === false && candidate.params[1].toString().startsWith('!')) {
      return true;
    }
    return false;
  });

  return conflict;
}

export function pipelineRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
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
    const opDef = queryModeller.getOperationDef(x.id);
    if (!opDef) {
      return false;
    }
    return condition(opDef);
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

  const existingRangeVectorFunction = operations.find((x) => {
    const opDef = modeller.getOperationDef(x.id);
    if (!opDef) {
      return false;
    }
    return isRangeVectorFunction(opDef);
  });

  switch (def.category) {
    case LokiVisualQueryOperationCategory.Aggregations:
    case LokiVisualQueryOperationCategory.Functions:
      // If we are adding a function but we have not range vector function yet add one
      if (!existingRangeVectorFunction) {
        const placeToInsert = getIndexOfOrLast(
          operations,
          modeller,
          (def) => def.category === LokiVisualQueryOperationCategory.Functions
        );
        operations.splice(placeToInsert, 0, { id: LokiOperationId.Rate, params: ['$__interval'] });
      }
      operations.push(newOperation);
      break;
    case LokiVisualQueryOperationCategory.RangeFunctions:
      // If adding a range function and range function is already added replace it
      if (existingRangeVectorFunction) {
        const index = operations.indexOf(existingRangeVectorFunction);
        operations[index] = newOperation;
        break;
      }

    // Add range functions after any formats, line filters and label filters
    default:
      const placeToInsert = getIndexOfOrLast(
        operations,
        modeller,
        (x) => (def.orderRank ?? 100) < (x.orderRank ?? 100)
      );
      operations.splice(placeToInsert, 0, newOperation);
      break;
  }

  return {
    ...query,
    operations,
  };
}

export function addNestedQueryHandler(def: QueryBuilderOperationDef, query: LokiVisualQuery): LokiVisualQuery {
  return {
    ...query,
    binaryQueries: [
      ...(query.binaryQueries ?? []),
      {
        operator: '/',
        query,
      },
    ],
  };
}

export function getLineFilterRenderer(operation: string, caseInsensitive?: boolean) {
  return function lineFilterRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    if (caseInsensitive) {
      return `${innerExpr} ${operation} \`(?i)${model.params[0]}\``;
    }
    return `${innerExpr} ${operation} \`${model.params[0]}\``;
  };
}

function getRangeVectorParamDef(): QueryBuilderOperationParamDef {
  return {
    name: 'Range',
    type: 'string',
    options: ['$__interval', '$__range', '1m', '5m', '10m', '1h', '24h'],
  };
}
