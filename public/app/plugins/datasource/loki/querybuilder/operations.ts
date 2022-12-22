import {
  createAggregationOperation,
  createAggregationOperationWithParam,
} from '../../prometheus/querybuilder/shared/operationUtils';
import { QueryBuilderOperationDef, QueryBuilderOperationParamValue } from '../../prometheus/querybuilder/shared/types';

import { binaryScalarOperations } from './binaryScalarOperations';
import { UnwrapParamEditor } from './components/UnwrapParamEditor';
import {
  addLokiOperation,
  addNestedQueryHandler,
  createRangeOperation,
  createRangeOperationWithGrouping,
  getLineFilterRenderer,
  labelFilterRenderer,
  pipelineRenderer,
} from './operationUtils';
import { LokiOperationId, LokiOperationOrder, LokiVisualQueryOperationCategory } from './types';

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

  const rangeOperations = [
    createRangeOperation(LokiOperationId.Rate),
    createRangeOperation(LokiOperationId.RateCounter),
    createRangeOperation(LokiOperationId.CountOverTime),
    createRangeOperation(LokiOperationId.SumOverTime),
    createRangeOperation(LokiOperationId.BytesRate),
    createRangeOperation(LokiOperationId.BytesOverTime),
    createRangeOperation(LokiOperationId.AbsentOverTime),
  ];

  const rangeOperationsWithGrouping = [
    ...createRangeOperationWithGrouping(LokiOperationId.AvgOverTime),
    ...createRangeOperationWithGrouping(LokiOperationId.MaxOverTime),
    ...createRangeOperationWithGrouping(LokiOperationId.MinOverTime),
    ...createRangeOperationWithGrouping(LokiOperationId.FirstOverTime),
    ...createRangeOperationWithGrouping(LokiOperationId.LastOverTime),
    ...createRangeOperationWithGrouping(LokiOperationId.StdvarOverTime),
    ...createRangeOperationWithGrouping(LokiOperationId.StddevOverTime),
    ...createRangeOperationWithGrouping(LokiOperationId.QuantileOverTime),
  ];

  const list: QueryBuilderOperationDef[] = [
    ...aggregations,
    ...aggregationsWithParam,
    ...rangeOperations,
    ...rangeOperationsWithGrouping,
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

Example: \`\`error_level=\`level\` \`\`

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
      id: LokiOperationId.LineContainsCaseInsensitive,
      name: 'Line contains case insensitive',
      params: [
        {
          name: 'String',
          type: 'string',
          hideName: true,
          placeholder: 'Text to find',
          description: 'Find log lines that contains this text',
          minWidth: 33,
          runQueryOnEnter: true,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      orderRank: LokiOperationOrder.LineFilters,
      renderer: getLineFilterRenderer('|~', true),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that match regex \`(?i)${op.params[0]}\`.`,
    },
    {
      id: LokiOperationId.LineContainsNotCaseInsensitive,
      name: 'Line does not contain case insensitive',
      params: [
        {
          name: 'String',
          type: 'string',
          hideName: true,
          placeholder: 'Text to exclude',
          description: 'Find log lines that does not contain this text',
          minWidth: 40,
          runQueryOnEnter: true,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'line filter',
      category: LokiVisualQueryOperationCategory.LineFilters,
      orderRank: LokiOperationOrder.LineFilters,
      renderer: getLineFilterRenderer('!~', true),
      addOperationHandler: addLokiOperation,
      explainHandler: (op) => `Return log lines that does not match regex \`(?i)${op.params[0]}\`.`,
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

// Keeping a local copy as an optimization measure.
const definitions = getOperationDefinitions();

/**
 * Given an operator, return the corresponding explain.
 * For usage within the Query Editor.
 */
export function explainOperator(id: LokiOperationId | string): string {
  const definition = definitions.find((operation) => operation.id === id);

  const explain = definition?.explainHandler?.({ id: '', params: ['<value>'] }) || '';

  // Strip markdown links
  return explain.replace(/\[(.*)\]\(.*\)/g, '$1');
}

export function getDefinitionById(id: string): QueryBuilderOperationDef | undefined {
  return definitions.find((x) => x.id === id);
}

export function checkParamsAreValid(def: QueryBuilderOperationDef, params: QueryBuilderOperationParamValue[]): boolean {
  // For now we only check if the operation has all the required params.
  if (params.length < def.params.filter((param) => !param.optional).length) {
    return false;
  }

  return true;
}
