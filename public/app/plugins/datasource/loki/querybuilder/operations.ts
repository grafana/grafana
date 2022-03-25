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
import { FUNCTIONS } from '../syntax';
import { LokiOperationId, LokiOperationOrder, LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

export function getOperationDefintions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    createRangeOperation(LokiOperationId.Rate),
    createRangeOperation(LokiOperationId.CountOverTime),
    createRangeOperation(LokiOperationId.SumOverTime),
    createRangeOperation(LokiOperationId.BytesRate),
    createRangeOperation(LokiOperationId.BytesOverTime),
    createRangeOperation(LokiOperationId.AbsentOverTime),
    createAggregationOperation(LokiOperationId.Sum),
    createAggregationOperation(LokiOperationId.Avg),
    createAggregationOperation(LokiOperationId.Min),
    createAggregationOperation(LokiOperationId.Max),
    {
      id: LokiOperationId.Json,
      name: 'Json',
      params: [],
      defaultParams: [],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.LineFormats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
    },
    {
      id: LokiOperationId.Logfmt,
      name: 'Logfmt',
      params: [],
      defaultParams: [],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.LineFormats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
      explainHandler: () =>
        `This will extract all keys and values from a [logfmt](https://grafana.com/docs/loki/latest/logql/log_queries/#logfmt) formatted log line as labels. The extracted lables can be used in label filter expressions and used as values for a range aggregation via the unwrap operation. `,
    },
    {
      id: LokiOperationId.LineContains,
      name: 'Line contains',
      params: [
        {
          name: 'String',
          type: 'string',
          hideName: true,
          placeholder: 'Text to find',
          description: 'Find log lines that contains this text',
          minWidth: 20,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      orderRank: LokiOperationOrder.LineFilters,
      renderer: getLineFilterRenderer('|='),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that contain string \`${op.params[0]}\`.`,
    },
    {
      id: LokiOperationId.LineContainsNot,
      name: 'Line does not contain',
      params: [
        {
          name: 'String',
          type: 'string',
          hideName: true,
          placeholder: 'Text to exclude',
          description: 'Find log lines that does not contain this text',
          minWidth: 26,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      orderRank: LokiOperationOrder.LineFilters,
      renderer: getLineFilterRenderer('!='),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that does not contain string \`${op.params[0]}\`.`,
    },
    {
      id: LokiOperationId.LineMatchesRegex,
      name: 'Line contains regex match',
      params: [
        {
          name: 'Regex',
          type: 'string',
          hideName: true,
          placeholder: 'Pattern to match',
          description: 'Find log lines that match this regex pattern',
          minWidth: 30,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      orderRank: LokiOperationOrder.LineFilters,
      renderer: getLineFilterRenderer('|~'),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that match regex \`${op.params[0]}\`.`,
    },
    {
      id: LokiOperationId.LineMatchesRegexNot,
      name: 'Line does not match regex',
      params: [
        {
          name: 'Regex',
          type: 'string',
          hideName: true,
          placeholder: 'Pattern to exclude',
          description: 'Find log lines that does not match this regex pattern',
          minWidth: 30,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      orderRank: LokiOperationOrder.LineFilters,
      renderer: getLineFilterRenderer('!~'),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that does not match regex \`${op.params[0]}\`.`,
    },
    {
      id: LokiOperationId.LabelFilter,
      name: 'Label filter expression',
      params: [
        { name: 'Label', type: 'string' },
        { name: 'Operator', type: 'string', options: ['=', '!=', '>', '<', '>=', '<='] },
        { name: 'Value', type: 'string' },
      ],
      defaultParams: ['', '=', ''],
      category: LokiVisualQueryOperationCategory.LabelFilters,
      orderRank: LokiOperationOrder.LabelFilters,
      renderer: labelFilterRenderer,
      addOperationHandler: addLokiOperation,
      explainHandler: () => `Label expression filter allows filtering using original and extracted labels.`,
    },
    {
      id: LokiOperationId.LabelFilterNoErrors,
      name: 'No pipeline errors',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.LabelFilters,
      orderRank: LokiOperationOrder.NoErrors,
      renderer: (model, def, innerExpr) => `${innerExpr} | __error__=""`,
      addOperationHandler: addLokiOperation,
      explainHandler: () => `Filter out all formatting and parsing errors.`,
    },
    {
      id: LokiOperationId.Unwrap,
      name: 'Unwrap',
      params: [{ name: 'Identifier', type: 'string', hideName: true, minWidth: 16, placeholder: 'Label key' }],
      defaultParams: [''],
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.Unwrap,
      renderer: (op, def, innerExpr) => `${innerExpr} | unwrap ${op.params[0]}`,
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => {
        let label = String(op.params[0]).length > 0 ? op.params[0] : '<label>';
        return `Use the extracted label \`${label}\` as sample values instead of log lines for the subsequent range aggregation.`;
      },
    },
  ];

  return list;
}

function createRangeOperation(name: string): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromAndLokiOperationDisplayName(name),
    params: [getRangeVectorParamDef()],
    defaultParams: ['$__interval'],
    alternativesKey: 'range function',
    category: LokiVisualQueryOperationCategory.RangeFunctions,
    orderRank: LokiOperationOrder.RangeVectorFunction,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: addLokiOperation,
    explainHandler: (op, def) => {
      let opDocs = FUNCTIONS.find((x) => x.insertText === op.id)?.documentation ?? '';

      if (op.params[0] === '$__interval') {
        return `${opDocs} \`$__interval\` is variable that will be replaced with a calculated interval based on **Max data points**,  **Min interval** and query time range. You find these options you find under **Query options** at the right of the data source select dropdown.`;
      } else {
        return `${opDocs} The [range vector](https://grafana.com/docs/loki/latest/logql/metric_queries/#range-vector-aggregation) is set to \`${op.params[0]}\`.`;
      }
    },
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
    orderRank: LokiOperationOrder.Last,
    renderer: functionRendererLeft,
    addOperationHandler: addLokiOperation,
    explainHandler: (op, def) => {
      const opDocs = FUNCTIONS.find((x) => x.insertText === op.id);
      return `${opDocs?.documentation}.`;
    },
  };
}

function getRangeVectorParamDef(): QueryBuilderOperationParamDef {
  return {
    name: 'Range',
    type: 'string',
    options: ['$__interval', '$__range', '1m', '5m', '10m', '1h', '24h'],
  };
}

function operationWithRangeVectorRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  let rangeVector = (model.params ?? [])[0] ?? '$__interval';
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
        operations.splice(placeToInsert, 0, { id: LokiOperationId.Rate, params: ['auto'] });
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
