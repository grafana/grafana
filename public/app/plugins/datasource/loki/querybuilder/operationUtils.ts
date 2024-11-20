import { capitalize } from 'lodash';
import pluralize from 'pluralize';

import {
  QueryBuilderOperation,
  QueryBuilderOperationDefinition,
  QueryBuilderOperationParamDef,
  QueryBuilderOperationParamValue,
  VisualQuery,
  VisualQueryModeller,
} from '@grafana/experimental';

import { escapeLabelValueInExactSelector } from '../languageUtils';
import { FUNCTIONS } from '../syntax';

import { LabelParamEditor } from './components/LabelParamEditor';
import { LokiOperationId, LokiOperationOrder, LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

export function createRangeOperation(
  name: string,
  isRangeOperationWithGrouping?: boolean
): QueryBuilderOperationDefinition {
  const params = [getRangeVectorParamDef()];
  const defaultParams = ['$__auto'];
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
    name: getLokiOperationDisplayName(name),
    params: params,
    defaultParams,
    toggleable: true,
    alternativesKey: 'range function',
    category: LokiVisualQueryOperationCategory.RangeFunctions,
    orderRank: LokiOperationOrder.RangeVectorFunction,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: addLokiOperation,
    paramChangedHandler,
    explainHandler: (op, def) => {
      let opDocs = FUNCTIONS.find((x) => x.insertText === op.id)?.documentation ?? '';

      if (op.params[0] === '$__auto') {
        return `${opDocs} \`$__auto\` is a variable that will be replaced with the [value of step](https://grafana.com/docs/grafana/next/datasources/loki/query-editor/#options) for range queries and with the value of the selected time range (calculated to - from) for instant queries.`;
      } else {
        return `${opDocs} The [range vector](https://grafana.com/docs/loki/latest/logql/metric_queries/#range-vector-aggregation) is set to \`${op.params[0]}\`.`;
      }
    },
  };
}

export function createRangeOperationWithGrouping(name: string): QueryBuilderOperationDefinition[] {
  const rangeOperation = createRangeOperation(name, true);
  // Copy range operation params without the last param
  const params = rangeOperation.params.slice(0, -1);
  const operations: QueryBuilderOperationDefinition[] = [
    rangeOperation,
    {
      id: `__${name}_by`,
      name: `${getLokiOperationDisplayName(name)} by`,
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
      toggleable: true,
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
      name: `${getLokiOperationDisplayName(name)} without`,
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
  return function aggregationRenderer(
    model: QueryBuilderOperation,
    def: QueryBuilderOperationDefinition,
    innerExpr: string
  ) {
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
  def: QueryBuilderOperationDefinition,
  innerExpr: string
) {
  const params = model.params ?? [];
  const rangeVector = params[0] ?? '$__auto';
  // QuantileOverTime is only range vector with more than one param
  if (params.length === 2 && model.id === LokiOperationId.QuantileOverTime) {
    const quantile = params[1];
    return `${model.id}(${quantile}, ${innerExpr} [${rangeVector}])`;
  }

  return `${model.id}(${innerExpr} [${params[0] ?? '$__auto'}])`;
}

export function labelFilterRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDefinition,
  innerExpr: string
) {
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
  if (!operation) {
    return false;
  }
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

export function pipelineRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDefinition,
  innerExpr: string
) {
  switch (model.id) {
    case LokiOperationId.Logfmt:
      const [strict = false, keepEmpty = false, ...labels] = model.params;
      return `${innerExpr} | logfmt${strict ? ' --strict' : ''}${keepEmpty ? ' --keep-empty' : ''} ${labels
        .filter((label) => label)
        .join(', ')}`.trim();
    case LokiOperationId.Json:
      return `${innerExpr} | json ${model.params.filter((param) => param).join(', ')}`.trim();
    case LokiOperationId.Drop:
      return `${innerExpr} | drop ${model.params.filter((param) => param).join(', ')}`.trim();
    case LokiOperationId.Keep:
      return `${innerExpr} | keep ${model.params.filter((param) => param).join(', ')}`.trim();
    default:
      return `${innerExpr} | ${model.id}`;
  }
}

function isRangeVectorFunction(def: QueryBuilderOperationDefinition) {
  return def.category === LokiVisualQueryOperationCategory.RangeFunctions;
}

function getIndexOfOrLast(
  operations: QueryBuilderOperation[],
  queryModeller: VisualQueryModeller,
  condition: (def: QueryBuilderOperationDefinition) => boolean
) {
  const index = operations.findIndex((x) => {
    const opDef = queryModeller.getOperationDefinition(x.id);
    if (!opDef) {
      return false;
    }
    return condition(opDef);
  });

  return index === -1 ? operations.length : index;
}

export function addLokiOperation(
  def: QueryBuilderOperationDefinition,
  query: LokiVisualQuery,
  modeller: VisualQueryModeller
): LokiVisualQuery {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  const operations = [...query.operations];

  const existingRangeVectorFunction = operations.find((x) => {
    const opDef = modeller.getOperationDefinition(x.id);
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
        operations.splice(placeToInsert, 0, { id: LokiOperationId.Rate, params: ['$__auto'] });
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

export function addNestedQueryHandler(def: QueryBuilderOperationDefinition, query: LokiVisualQuery): LokiVisualQuery {
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
  return function lineFilterRenderer(
    model: QueryBuilderOperation,
    def: QueryBuilderOperationDefinition,
    innerExpr: string
  ) {
    const hasBackticks = model.params.some((param) => typeof param === 'string' && param.includes('`'));
    const delimiter = hasBackticks ? '"' : '`';
    let params;
    if (hasBackticks) {
      params = model.params.map((param) =>
        typeof param === 'string' ? escapeLabelValueInExactSelector(param) : param
      );
    } else {
      params = model.params;
    }
    if (caseInsensitive) {
      return `${innerExpr} ${operation} ${delimiter}(?i)${params.join(`${delimiter} or ${delimiter}(?i)`)}${delimiter}`;
    }
    return `${innerExpr} ${operation} ${delimiter}${params.join(`${delimiter} or ${delimiter}`)}${delimiter}`;
  };
}
function getRangeVectorParamDef(): QueryBuilderOperationParamDef {
  return {
    name: 'Range',
    type: 'string',
    options: ['$__auto', '1m', '5m', '10m', '1h', '24h'],
  };
}

export function getOperationParamId(operationId: string, paramIndex: number) {
  return `operations.${operationId}.param.${paramIndex}`;
}

export function getOnLabelAddedHandler(changeToOperationId: string) {
  return function onParamChanged(index: number, op: QueryBuilderOperation, def: QueryBuilderOperationDefinition) {
    // Check if we actually have the label param. As it's optional the aggregation can have one less, which is the
    // case of just simple aggregation without label. When user adds the label it now has the same number of params
    // as its definition, and now we can change it to its `_by` variant.
    if (op.params.length === def.params.length) {
      return {
        ...op,
        id: changeToOperationId,
      };
    }
    return op;
  };
}

/**
 * Very simple poc implementation, needs to be modified to support all aggregation operators
 */
export function getAggregationExplainer(aggregationName: string, mode: 'by' | 'without' | '') {
  return function aggregationExplainer(model: QueryBuilderOperation) {
    const labels = model.params.map((label) => `\`${label}\``).join(' and ');
    const labelWord = pluralize('label', model.params.length);

    switch (mode) {
      case 'by':
        return `Calculates ${aggregationName} over dimensions while preserving ${labelWord} ${labels}.`;
      case 'without':
        return `Calculates ${aggregationName} over the dimensions ${labels}. All other labels are preserved.`;
      default:
        return `Calculates ${aggregationName} over the dimensions.`;
    }
  };
}

/**
 * This function will transform operations without labels to their plan aggregation operation
 */
export function getLastLabelRemovedHandler(changeToOperationId: string) {
  return function onParamChanged(index: number, op: QueryBuilderOperation, def: QueryBuilderOperationDefinition) {
    // If definition has more params then is defined there are no optional rest params anymore.
    // We then transform this operation into a different one
    if (op.params.length < def.params.length) {
      return {
        ...op,
        id: changeToOperationId,
      };
    }

    return op;
  };
}

export function getLokiOperationDisplayName(funcName: string) {
  return capitalize(funcName.replace(/_/g, ' '));
}

export function defaultAddOperationHandler<T extends VisualQuery>(def: QueryBuilderOperationDefinition, query: T) {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  return {
    ...query,
    operations: [...query.operations, newOperation],
  };
}

export function createAggregationOperation(
  name: string,
  overrides: Partial<QueryBuilderOperationDefinition> = {}
): QueryBuilderOperationDefinition[] {
  const operations: QueryBuilderOperationDefinition[] = [
    {
      id: name,
      name: getLokiOperationDisplayName(name),
      params: [
        {
          name: 'By label',
          type: 'string',
          restParam: true,
          optional: true,
        },
      ],
      defaultParams: [],
      toggleable: true,
      alternativesKey: 'plain aggregations',
      category: LokiVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      paramChangedHandler: getOnLabelAddedHandler(`__${name}_by`),
      explainHandler: getAggregationExplainer(name, ''),
      addOperationHandler: defaultAddOperationHandler,
      ...overrides,
    },
    {
      id: `__${name}_by`,
      name: `${getLokiOperationDisplayName(name)} by`,
      params: [
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: LabelParamEditor,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'aggregations by',
      category: LokiVisualQueryOperationCategory.Aggregations,
      renderer: getAggregationByRenderer(name),
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'by'),
      addOperationHandler: defaultAddOperationHandler,
      hideFromList: true,
      ...overrides,
    },
    {
      id: `__${name}_without`,
      name: `${getLokiOperationDisplayName(name)} without`,
      params: [
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: LabelParamEditor,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'aggregations by',
      category: LokiVisualQueryOperationCategory.Aggregations,
      renderer: getAggregationWithoutRenderer(name),
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'without'),
      addOperationHandler: defaultAddOperationHandler,
      hideFromList: true,
      ...overrides,
    },
  ];

  return operations;
}

function getAggregationWithoutRenderer(aggregation: string) {
  return function aggregationRenderer(
    model: QueryBuilderOperation,
    def: QueryBuilderOperationDefinition,
    innerExpr: string
  ) {
    return `${aggregation} without(${model.params.join(', ')}) (${innerExpr})`;
  };
}

export function functionRendererLeft(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDefinition,
  innerExpr: string
) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.push(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function renderParams(model: QueryBuilderOperation, def: QueryBuilderOperationDefinition, innerExpr: string) {
  return (model.params ?? []).map((value, index) => {
    const paramDef = def.params[index];
    if (paramDef.type === 'string') {
      return '"' + value + '"';
    }

    return value;
  });
}

function getAggregationByRenderer(aggregation: string) {
  return function aggregationRenderer(
    model: QueryBuilderOperation,
    def: QueryBuilderOperationDefinition,
    innerExpr: string
  ) {
    return `${aggregation} by(${model.params.join(', ')}) (${innerExpr})`;
  };
}

export function createAggregationOperationWithParam(
  name: string,
  paramsDef: { params: QueryBuilderOperationParamDef[]; defaultParams: QueryBuilderOperationParamValue[] },
  overrides: Partial<QueryBuilderOperationDefinition> = {}
): QueryBuilderOperationDefinition[] {
  const operations = createAggregationOperation(name, overrides);
  operations[0].params.unshift(...paramsDef.params);
  operations[1].params.unshift(...paramsDef.params);
  operations[2].params.unshift(...paramsDef.params);
  operations[0].defaultParams = paramsDef.defaultParams;
  operations[1].defaultParams = [...paramsDef.defaultParams, ''];
  operations[2].defaultParams = [...paramsDef.defaultParams, ''];
  operations[1].renderer = getAggregationByRendererWithParameter(name);
  operations[2].renderer = getAggregationByRendererWithParameter(name);
  return operations;
}

function getAggregationByRendererWithParameter(aggregation: string) {
  return function aggregationRenderer(
    model: QueryBuilderOperation,
    def: QueryBuilderOperationDefinition,
    innerExpr: string
  ) {
    const restParamIndex = def.params.findIndex((param) => param.restParam);
    const params = model.params.slice(0, restParamIndex);
    const restParams = model.params.slice(restParamIndex);

    return `${aggregation} by(${restParams.join(', ')}) (${params
      .map((param, idx) => (def.params[idx].type === 'string' ? `\"${param}\"` : param))
      .join(', ')}, ${innerExpr})`;
  };
}
