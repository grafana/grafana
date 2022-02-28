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
import { LokiOperationId, LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

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
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
      explainHandler: () =>
        `This will extract all keys and values from a [logfmt](https://grafana.com/docs/loki/latest/logql/log_queries/#logfmt) formatted log line as labels. The extracted lables can be used in label filter expressions and used as values for a range aggregation via the unwrap operation. `,
    },
    {
      id: LokiOperationId.LineContains,
      name: 'Line contains',
      params: [{ name: 'String', type: 'string' }],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('|='),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that contain string \`${op.params[0]}\`.`,
    },
    {
      id: LokiOperationId.LineContainsNot,
      name: 'Line does not contain',
      params: [{ name: 'String', type: 'string' }],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('!='),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that does not contain string \`${op.params[0]}\`.`,
    },
    {
      id: LokiOperationId.LineMatchesRegex,
      name: 'Line contains regex match',
      params: [{ name: 'Regex', type: 'string' }],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('|~'),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that match regex \`${op.params[0]}\`.`,
    },
    {
      id: LokiOperationId.LineMatchesRegexNot,
      name: 'Line does not match regex',
      params: [{ name: 'Regex', type: 'string' }],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
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
      renderer: (model, def, innerExpr) => `${innerExpr} | __error__=""`,
      addOperationHandler: addLokiOperation,
      explainHandler: () => `Filter out all formatting and parsing errors.`,
    },
    {
      id: LokiOperationId.Unwrap,
      name: 'Unwrap',
      params: [{ name: 'Identifier', type: 'string' }],
      defaultParams: [''],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: (op, def, innerExpr) => `${innerExpr} | unwrap ${op.params[0]}`,
      addOperationHandler: addLokiOperation,
      explainHandler: (op) =>
        `Use the extracted label \`${op.params[0]}\` as sample values instead of log lines for the subsequent range aggregation.`,
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
