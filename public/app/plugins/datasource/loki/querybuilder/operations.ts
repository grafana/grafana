import {
  createAggregationOperation,
  createAggregationOperationWithParam,
  getPromAndLokiOperationDisplayName,
} from '../../prometheus/querybuilder/shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  VisualQueryModeller,
} from '../../prometheus/querybuilder/shared/types';
import { FUNCTIONS } from '../syntax';

import { binaryScalarOperations } from './binaryScalarOperations';
import { UnwrapParamEditor } from './components/UnwrapParamEditor';
import { LokiOperationId, LokiOperationOrder, LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

export function getOperationDefinitions(): QueryBuilderOperationDef[] {
  const aggregations = [
    LokiOperationId.Sum,
    LokiOperationId.Min,
    LokiOperationId.Max,
    LokiOperationId.Avg,
    LokiOperationId.Stddev,
    LokiOperationId.Stdvar,
    LokiOperationId.Count,
  ].flatMap((opId) =>
    createAggregationOperation(opId, {
      addOperationHandler: addLokiOperation,
      orderRank: LokiOperationOrder.Last,
    })
  );

  const aggregationsWithParam = [LokiOperationId.TopK, LokiOperationId.BottomK].flatMap((opId) => {
    return createAggregationOperationWithParam(
      opId,
      {
        params: [{ name: 'K-value', type: 'number' }],
        defaultParams: [5],
      },
      {
        addOperationHandler: addLokiOperation,
        orderRank: LokiOperationOrder.Last,
      }
    );
  });

  const list: QueryBuilderOperationDef[] = [
    createRangeOperation(LokiOperationId.Rate),
    createRangeOperation(LokiOperationId.CountOverTime),
    createRangeOperation(LokiOperationId.SumOverTime),
    createRangeOperation(LokiOperationId.BytesRate),
    createRangeOperation(LokiOperationId.BytesOverTime),
    createRangeOperation(LokiOperationId.AbsentOverTime),
    createRangeOperation(LokiOperationId.AvgOverTime),
    createRangeOperation(LokiOperationId.MaxOverTime),
    createRangeOperation(LokiOperationId.MinOverTime),
    createRangeOperation(LokiOperationId.FirstOverTime),
    createRangeOperation(LokiOperationId.LastOverTime),
    createRangeOperation(LokiOperationId.StdvarOverTime),
    createRangeOperation(LokiOperationId.StddevOverTime),
    createRangeOperation(LokiOperationId.QuantileOverTime),
    ...aggregations,
    ...aggregationsWithParam,
    {
      id: LokiOperationId.Json,
      name: 'Json',
      params: [
        {
          name: 'Expression',
          type: 'string',
          restParam: true,
          optional: true,
          minWidth: 18,
          placeholder: 'server="servers[0]"',
          description:
            'Using expressions with your json parser will extract only the specified json fields to labels. You can specify one or more expressions in this way. All expressions must be quoted.',
        },
      ],
      defaultParams: [],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.LineFormats,
      renderer: (model, def, innerExpr) => `${innerExpr} | json ${model.params.join(', ')}`.trim(),
      addOperationHandler: addLokiOperation,
      explainHandler: () =>
        `This will extract keys and values from a [json](https://grafana.com/docs/loki/latest/logql/log_queries/#json) formatted log line as labels. The extracted labels can be used in label filter expressions and used as values for a range aggregation via the unwrap operation.`,
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
        `This will extract all keys and values from a [logfmt](https://grafana.com/docs/loki/latest/logql/log_queries/#logfmt) formatted log line as labels. The extracted labels can be used in label filter expressions and used as values for a range aggregation via the unwrap operation.`,
    },
    {
      id: LokiOperationId.Regexp,
      name: 'Regexp',
      params: [
        {
          name: 'String',
          type: 'string',
          hideName: true,
          placeholder: '<re>',
          description: 'The regexp expression that matches the structure of a log line.',
          minWidth: 20,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.LineFormats,
      renderer: (model, def, innerExpr) => `${innerExpr} | regexp \`${model.params[0]}\``,
      addOperationHandler: addLokiOperation,
      explainHandler: () =>
        `The [regexp parser](https://grafana.com/docs/loki/latest/logql/log_queries/#regular-expression) takes a single parameter | regexp "<re>" which is the regular expression using the Golang RE2 syntax. The regular expression must contain a least one named sub-match (e.g (?P<name>re)), each sub-match will extract a different label. The expression matches the structure of a log line. The extracted labels can be used in label filter expressions and used as values for a range aggregation via the unwrap operation.`,
    },
    {
      id: LokiOperationId.Pattern,
      name: 'Pattern',
      params: [
        {
          name: 'String',
          type: 'string',
          hideName: true,
          placeholder: '<pattern-expression>',
          description: 'The expression that matches the structure of a log line.',
          minWidth: 20,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.LineFormats,
      renderer: (model, def, innerExpr) => `${innerExpr} | pattern \`${model.params[0]}\``,
      addOperationHandler: addLokiOperation,
      explainHandler: () =>
        `The [pattern parser](https://grafana.com/docs/loki/latest/logql/log_queries/#pattern) allows the explicit extraction of fields from log lines by defining a pattern expression (| pattern \`<pattern-expression>\`). The expression matches the structure of a log line. The extracted labels can be used in label filter expressions and used as values for a range aggregation via the unwrap operation.`,
    },
    {
      id: LokiOperationId.Unpack,
      name: 'Unpack',
      params: [],
      defaultParams: [],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.LineFormats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
      explainHandler: () =>
        `This will extract all keys and values from a JSON log line, [unpacking](https://grafana.com/docs/loki/latest/logql/log_queries/#unpack) all embedded labels in the pack stage. The extracted labels can be used in label filter expressions and used as values for a range aggregation via the unwrap operation.`,
    },
    {
      id: LokiOperationId.LineFormat,
      name: 'Line format',
      params: [
        {
          name: 'String',
          type: 'string',
          hideName: true,
          placeholder: '{{.status_code}}',
          description: 'A line template that can refer to stream labels and extracted labels.',
          minWidth: 20,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.LineFormats,
      renderer: (model, def, innerExpr) => `${innerExpr} | line_format \`${model.params[0]}\``,
      addOperationHandler: addLokiOperation,
      explainHandler: () =>
        `This will replace log line using a specified template. The template can refer to stream labels and extracted labels.

        Example: \`{{.status_code}} - {{.message}}\`

        [Read the docs](https://grafana.com/docs/loki/latest/logql/log_queries/#line-format-expression) for more.
        `,
    },
    {
      id: LokiOperationId.LabelFormat,
      name: 'Label format',
      params: [
        { name: 'Label', type: 'string' },
        { name: 'Rename to', type: 'string' },
      ],
      defaultParams: ['', ''],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.LineFormats,
      renderer: (model, def, innerExpr) => `${innerExpr} | label_format ${model.params[1]}=${model.params[0]}`,
      addOperationHandler: addLokiOperation,
      explainHandler: () =>
        `This will change name of label to desired new label. In the example below, label "error_level" will be renamed to "level".

        Example: error_level=\`level\`

        [Read the docs](https://grafana.com/docs/loki/latest/logql/log_queries/#labels-format-expression) for more.
        `,
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
          runQueryOnEnter: true,
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
          runQueryOnEnter: true,
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
          runQueryOnEnter: true,
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
          runQueryOnEnter: true,
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
      id: LokiOperationId.LineFilterIpMatches,
      name: 'IP line filter expression',
      params: [
        { name: 'Operator', type: 'string', options: ['|=', '!='] },
        {
          name: 'Pattern',
          type: 'string',
          placeholder: '<pattern>',
          minWidth: 16,
          runQueryOnEnter: true,
        },
      ],
      defaultParams: ['|=', ''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      orderRank: LokiOperationOrder.LineFilters,
      renderer: (op, def, innerExpr) => `${innerExpr} ${op.params[0]} ip(\`${op.params[1]}\`)`,
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines using IP matching of \`${op.params[1]}\``,
    },
    {
      id: LokiOperationId.LabelFilter,
      name: 'Label filter expression',
      params: [
        { name: 'Label', type: 'string' },
        { name: 'Operator', type: 'string', options: ['=', '!=', ' =~', '!~', '>', '<', '>=', '<='] },
        { name: 'Value', type: 'string' },
      ],
      defaultParams: ['', '=', ''],
      alternativesKey: 'label filter',
      category: LokiVisualQueryOperationCategory.LabelFilters,
      orderRank: LokiOperationOrder.LabelFilters,
      renderer: labelFilterRenderer,
      addOperationHandler: addLokiOperation,
      explainHandler: () => `Label expression filter allows filtering using original and extracted labels.`,
    },
    {
      id: LokiOperationId.LabelFilterIpMatches,
      name: 'IP label filter expression',
      params: [
        { name: 'Label', type: 'string' },
        { name: 'Operator', type: 'string', options: ['=', '!='] },
        { name: 'Value', type: 'string' },
      ],
      defaultParams: ['', '=', ''],
      alternativesKey: 'label filter',
      category: LokiVisualQueryOperationCategory.LabelFilters,
      orderRank: LokiOperationOrder.LabelFilters,
      renderer: (model, def, innerExpr) =>
        `${innerExpr} | ${model.params[0]} ${model.params[1]} ip(\`${model.params[2]}\`)`,
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines using IP matching of \`${op.params[2]}\` for \`${op.params[0]}\` label`,
    },
    {
      id: LokiOperationId.LabelFilterNoErrors,
      name: 'No pipeline errors',
      params: [],
      defaultParams: [],
      alternativesKey: 'label filter',
      category: LokiVisualQueryOperationCategory.LabelFilters,
      orderRank: LokiOperationOrder.NoErrors,
      renderer: (model, def, innerExpr) => `${innerExpr} | __error__=\`\``,
      addOperationHandler: addLokiOperation,
      explainHandler: () => `Filter out all formatting and parsing errors.`,
    },
    {
      id: LokiOperationId.Unwrap,
      name: 'Unwrap',
      params: [
        {
          name: 'Identifier',
          type: 'string',
          hideName: true,
          minWidth: 16,
          placeholder: 'Label key',
          editor: UnwrapParamEditor,
        },
        {
          name: 'Conversion function',
          hideName: true,
          type: 'string',
          options: ['duration', 'duration_seconds', 'bytes'],
          optional: true,
        },
      ],
      defaultParams: ['', ''],
      alternativesKey: 'format',
      category: LokiVisualQueryOperationCategory.Formats,
      orderRank: LokiOperationOrder.Unwrap,
      renderer: (op, def, innerExpr) =>
        `${innerExpr} | unwrap ${op.params[1] ? `${op.params[1]}(${op.params[0]})` : op.params[0]}`,
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => {
        let label = String(op.params[0]).length > 0 ? op.params[0] : '<label>';
        return `Use the extracted label \`${label}\` as sample values instead of log lines for the subsequent range aggregation.${
          op.params[1]
            ? ` Conversion function \`${op.params[1]}\` wrapping \`${label}\` will attempt to convert this label from a specific format (e.g. 3k, 500ms).`
            : ''
        }`;
      },
    },
    ...binaryScalarOperations,
    {
      id: LokiOperationId.NestedQuery,
      name: 'Binary operation with query',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.BinaryOps,
      renderer: (model, def, innerExpr) => innerExpr,
      addOperationHandler: addNestedQueryHandler,
    },
  ];

  return list;
}

function createRangeOperation(name: string): QueryBuilderOperationDef {
  const params = [getRangeVectorParamDef()];
  const defaultParams = ['$__interval'];
  let renderer = operationWithRangeVectorRenderer;

  if (name === LokiOperationId.QuantileOverTime) {
    defaultParams.push('0.95');
    params.push({
      name: 'Quantile',
      type: 'number',
    });
    renderer = operationWithRangeVectorRendererAndParam;
  }

  return {
    id: name,
    name: getPromAndLokiOperationDisplayName(name),
    params,
    defaultParams,
    alternativesKey: 'range function',
    category: LokiVisualQueryOperationCategory.RangeFunctions,
    orderRank: LokiOperationOrder.RangeVectorFunction,
    renderer,
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

function operationWithRangeVectorRendererAndParam(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  const params = model.params ?? [];
  const rangeVector = params[0] ?? '$__interval';
  const param = params[1];
  return `${def.id}(${param}, ${innerExpr} [${rangeVector}])`;
}

function getLineFilterRenderer(operation: string) {
  return function lineFilterRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
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

  return `${innerExpr} | ${model.params[0]} ${model.params[1]} \`${model.params[2]}\``;
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

function addNestedQueryHandler(def: QueryBuilderOperationDef, query: LokiVisualQuery): LokiVisualQuery {
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
