import { SyntaxNode } from '@lezer/common';

import {
  BinOpExpr,
  BytesFilter,
  DecolorizeExpr,
  DistinctFilter,
  Grouping,
  JsonExpressionParser,
  LabelFilter,
  LabelFormatExpr,
  LabelParser,
  LineFilter,
  LineFormatExpr,
  LiteralExpr,
  LogRangeExpr,
  Matcher,
  parser,
  PipelineExpr,
  RangeAggregationExpr,
  Regexp,
  Selector,
  VectorAggregationExpr,
  VectorExpr,
} from '@grafana/lezer-logql';

import {
  formatLokiQuery,
  indent,
  indentMultiline,
  trimMultiline,
  needsBrackets,
  iterateNode,
  buildResponse,
  formatSelector,
  formatLineFilter,
  formatLabelParser,
  formatJsonExpressionParser,
  formatLabelFilter,
  formatLineFormatExpr,
  formatLabelFormatExpr,
  formatPipelineExpr,
  formatRangeAggregationExpr,
  formatLogRangeExpr,
  formatGrouping,
  formatVectorAggregationExpr,
  formatBinOpExpr,
  formatLiteralExpr,
  formatVectorExpr,
  formatDistinctFilter,
  formatDecolorizeExpr,
} from './formatter';

describe('formats logql queries', () => {
  it('correctly formats a log query', () => {
    // Selector
    expect(formatLokiQuery(`{ labelA = "",labelC = "",labelB = "" }`)).toBe(`{labelA="", labelB="", labelC=""}`);

    // Selector PipelineExpr
    expect(formatLokiQuery(`{label=""}|=""!=""|logfmt|label=""`)).toBe(
      `{label=""}\n  |= "" != ""\n  | logfmt\n  | label=""`
    );

    // ( LogExpr )
    expect(formatLokiQuery(`({label="",label=""})`)).toBe(`({label="", label=""})`);
  });

  it('correctly formats a range aggregation metric query', () => {
    // RangeOp "(" LogRangeExpr ")"
    expect(formatLokiQuery(`count_over_time ( {label=""} [5m])`)).toBe(`count_over_time(\n  {label=""}\n  [5m]\n)`);

    expect(
      formatLokiQuery(
        `quantile_over_time(0.99,{container="ingress-nginx",service="hosted-grafana"}| json| unwrap response_latency_seconds| __error__=""[1m]) by (cluster)`
      )
    ).toBe(
      `quantile_over_time(\n  0.99,\n  {container="ingress-nginx", service="hosted-grafana"}\n    | json\n  | unwrap response_latency_seconds | __error__=""\n  [1m]\n) by (cluster)`
    );

    // RangeOp "(" Number "," LogRangeExpr ")"
    expect(formatLokiQuery(`bytes_rate (1, {label=""} [5m])`)).toBe(`bytes_rate(\n  1,\n  {label=""}\n  [5m]\n)`);

    // RangeOp "(" LogRangeExpr ")" Grouping
    expect(formatLokiQuery(`rate ( {label=""} [5m])by(label)`)).toBe(`rate(\n  {label=""}\n  [5m]\n) by (label)`);

    // RangeOp "(" Number "," LogRangeExpr ")" Grouping
    expect(formatLokiQuery(`quantile_over_time (1, {label=""} [5m])by(label)`)).toBe(
      `quantile_over_time(\n  1,\n  {label=""}\n  [5m]\n) by (label)`
    );

    // ( MetricExpr(RangeAggregationExpr) )
    expect(formatLokiQuery(`(rate({label=""}[1s]))`)).toBe(`(rate(\n  {label=""}\n  [1s]\n))`);
  });

  // TODO: Nested Vector Operations are broken
  it('correctly formats a vector aggregation metric query', () => {
    // VectorOp "(" MetricExpr ")"
    expect(formatLokiQuery(`sum(count_over_time({label=""}[5m]))`)).toBe(
      `sum(\n  count_over_time(\n    {label=""}\n    [5m]\n  )\n)`
    );

    // VectorOp Grouping "(" MetricExpr ")"
    expect(formatLokiQuery(`sum by(label)(count_over_time({label=""}[5m]))`)).toBe(
      `sum by (label) (\n  count_over_time(\n    {label=""}\n    [5m]\n  )\n)`
    );

    // VectorOp "(" MetricExpr ")" Grouping
    expect(formatLokiQuery(`sum(count_over_time({label=""}[5m]))by(label)`)).toBe(
      `sum(\n  count_over_time(\n    {label=""}\n    [5m]\n  )\n) by (label)`
    );

    // VectorOp "(" Number "," MetricExpr ")"
    expect(formatLokiQuery(`sum(1, count_over_time({label=""}[5m]))`)).toBe(
      `sum(\n  1,\n  count_over_time(\n    {label=""}\n    [5m]\n  )\n)`
    );

    // VectorOp "(" Number "," MetricExpr ")" Grouping
    expect(formatLokiQuery(`sum(1, count_over_time({label=""}[5m]))by(label)`)).toBe(
      `sum(\n  1,\n  count_over_time(\n    {label=""}\n    [5m]\n  )\n) by (label)`
    );

    // VectorOp Grouping "(" Number "," MetricExpr ")"
    expect(formatLokiQuery(`sum by(label)(1, count_over_time({label=""}[5m]))`)).toBe(
      `sum by (label) (\n  1,\n  count_over_time(\n    {label=""}\n    [5m]\n  )\n)`
    );

    // ( MetricExpr(VectorAggregationExpr) )
    expect(formatLokiQuery(`(sum(rate({label=""}[1s])))`)).toBe(`(sum(\n  rate(\n    {label=""}\n    [1s]\n  )\n))`);

    // VectorOp "(" MetricExpr(VectorAggregationExpr) ")"
    // expect(formatLokiQuery(`count(sum(rate({compose_project="tns-custom"}[1s])))`)).toBe(
    //   `count(\n  sum(\n    rate(\n      {compose_project="tns-custom"}\n      [1s]\n    )\n  )\n)`
    // );
  });

  it('correctly formats a bin op metric query', () => {
    // Expr(LogExpr) !add Add BinOpModifier Expr(LogExpr)
    expect(formatLokiQuery(`{label=""} + {label=""}`)).toBe(`{label=""}\n+\n{label=""}`);

    // Expr(MetricExpr) !add Add BinOpModifier Expr(MetricExpr)
    expect(formatLokiQuery(`rate({label=""}[5m]) + rate({label=""}[5m])`)).toBe(
      `rate(\n  {label=""}\n  [5m]\n)\n+\nrate(\n  {label=""}\n  [5m]\n)`
    );

    // Expr(LogExpr) !add Add BinOpModifier Expr(MetricExpr)
    expect(formatLokiQuery(`{label=""} + rate({label=""}[5m])`)).toBe(`{label=""}\n+\nrate(\n  {label=""}\n  [5m]\n)`);

    // Expr(MetricExpr) !mul Div BinOpModifier Expr(LogExpr)
    expect(formatLokiQuery(`sum(rate({label=""}[1s])) / (count_over_time({label=""}[1s]) / 2)`)).toBe(
      `sum(\n  rate(\n    {label=""}\n    [1s]\n  )\n)\n/\n(count_over_time(\n  {label=""}\n  [1s]\n)\n/\n2)`
    );

    // ( MetricExpr(BinOpExpr) )
    expect(formatLokiQuery(`(rate({label=""}[1s]) + rate({label=""}[1s]))`)).toBe(
      '(rate(\n  {label=""}\n  [1s]\n)\n+\nrate(\n  {label=""}\n  [1s]\n))'
    );

    // ( LogExpr(BinOpExpr) )
    expect(formatLokiQuery(`({label=""} + {label=""})`)).toBe('({label=""}\n+\n{label=""})');
  });

  it('correctly formats a query with literal expressions', () => {
    // Selector BinOpExpr LiteralExpr
    expect(formatLokiQuery(`{label=""} + 1`)).toBe(`{label=""}\n+\n1`);

    // Selector BinOpExpr LiteralExpr(Add)
    expect(formatLokiQuery(`{label=""} + +1`)).toBe(`{label=""}\n+\n+1`);

    // Selector BinOpExpr LiteralExpr(Sub)
    expect(formatLokiQuery(`{label=""} + -1`)).toBe(`{label=""}\n+\n-1`);
  });

  // TODO: Not yet implemented
  it('correctly formats a query with label replace expr', () => {
    // LabelReplaceExpr
    // expect(formatLokiQuery(`label_replace()`)).toBe(`...`);
  });

  it('correctly formats a query using a vector expression', () => {
    // MetricExpr BinOpModifier VectorExpr
    expect(formatLokiQuery(`sum(count_over_time({namespace="traefik"}[5m])) or vector(0)`)).toBe(
      `sum(\n  count_over_time(\n    {namespace="traefik"}\n    [5m]\n  )\n)\nor\nvector(0)`
    );
  });
});

describe('formats queries using variables', () => {
  it('correctly formats a query using a variable', () => {
    // LogExpr
    expect(formatLokiQuery(`{label="$value_variable",label="val"}`)).toBe(`{label="$value_variable", label="val"}`);

    // MetricExpr
    expect(formatLokiQuery(`rate({label="val"}[$interval_variable])`)).toBe(
      `rate(\n  {label="val"}\n  [$interval_variable]\n)`
    );

    // MetricExpr
    expect(formatLokiQuery(`rate({label="val"}[$interval_variable]) + rate({label="val"}[$interval_variable_2])`)).toBe(
      `rate(\n  {label="val"}\n  [$interval_variable]\n)\n+\nrate(\n  {label="val"}\n  [$interval_variable_2]\n)`
    );

    // MetricExpr
    expect(formatLokiQuery(`rate({label="$value_variable"}[$interval_variable])`)).toBe(
      `rate(\n  {label="$value_variable"}\n  [$interval_variable]\n)`
    );
  });
});

describe('metric expression syntaxnode functions', () => {
  it('formatRangeAggregationExpr should return a formatted range aggregation expression', () => {
    const MOCK_NODE = generateNode(RangeAggregationExpr, `rate({label=""}[5m])`);
    expect(formatRangeAggregationExpr(MOCK_NODE, `rate({label=""}[5m])`)).toBe(`rate(\n  {label=""}\n  [5m]\n)`);
  });

  it('formatLogRangeExpr should return a formatted log range expression', () => {
    const MOCK_NODE = generateNode(LogRangeExpr, `rate({label=""}[5m])`);
    expect(formatLogRangeExpr(MOCK_NODE, `rate({label=""}[5m])`)).toBe(`  {label=""}\n  [5m]\n)`);
  });

  it('formatGrouping should return a formatted grouping', () => {
    const MOCK_NODE = generateNode(Grouping, `rate({label=""}[5m])by(abc)`);
    expect(formatGrouping(MOCK_NODE, `rate({label=""}[5m])by(abc)`)).toBe(` by (abc) `);
  });

  it('formatVectorAggregationExpr should return a formatted vector expr', () => {
    const MOCK_NODE = generateNode(VectorAggregationExpr, `sum(rate({label=""}[1s]))`);
    expect(formatVectorAggregationExpr(MOCK_NODE, `sum(rate({label=""}[1s]))`)).toBe(
      `sum(\n  rate(\n    {label=""}\n    [1s]\n  )\n)`
    );
  });

  it('formatBinOpExpr should return a formatted binop', () => {
    const MOCK_NODE = generateNode(BinOpExpr, `1 + 1`);
    expect(formatBinOpExpr(MOCK_NODE, `1 + 1`)).toBe(`1\n+\n1`);
  });

  it('formatLiteralExpr should return a formatted literal expr', () => {
    const MOCK_NODE_1 = generateNode(LiteralExpr, `+ 1`);
    expect(formatLiteralExpr(MOCK_NODE_1, `+ 1`)).toBe(`+1`);

    const MOCK_NODE_2 = generateNode(LiteralExpr, `- 1`);
    expect(formatLiteralExpr(MOCK_NODE_2, `- 1`)).toBe(`-1`);
  });

  it('formatVectorExpr should return a formatted literal expr', () => {
    const MOCK_NODE_1 = generateNode(VectorExpr, `{label=""} or vector ( 1 )`);
    expect(formatVectorExpr(MOCK_NODE_1, `{label=""} or vector ( 1 )`)).toBe(`vector(1)`);
  });
});

describe('log expression syntaxnode functions', () => {
  it('formatSelector should return a formatted selector', () => {
    const MOCK_NODE = generateNode(Selector, `{label="",label=""}`);
    expect(formatSelector(MOCK_NODE, `{label="",label=""}`)).toBe(`{label="", label=""}`);
  });

  it('formatPipelineExpr should return a formatted selector', () => {
    const MOCK_NODE = generateNode(PipelineExpr, `{}|=""!=""|logfmt|label=""`);
    expect(formatPipelineExpr(MOCK_NODE, `{}|=""!=""|logfmt|label=""`)).toBe(
      `\n  |= "" != ""\n  | logfmt\n  | label=""`
    );
  });

  it('formatLineFilter should return a formatted line filter', () => {
    const MOCK_NODE = generateNode(LineFilter, `{}|=""`);
    expect(formatLineFilter(MOCK_NODE, `{}|=""`)).toBe(`|= ""`);
  });

  it('formatLabelParser should return a formatted label parser', () => {
    const MOCK_NODE = generateNode(LabelParser, `{}|logfmt`);
    expect(formatLabelParser(MOCK_NODE, `{}|logfmt`)).toBe(`| logfmt`);
  });

  it('formatJsonExpressionParser should return formatted json expr parser', () => {
    const MOCK_NODE = generateNode(JsonExpressionParser, `{}|json label="",label=""`);
    expect(formatJsonExpressionParser(MOCK_NODE, `{}|json label="",label=""`)).toBe(`| json label="", label=""`);
  });

  it('formatLabelFilter should return formatted label filter', () => {
    const MOCK_NODE = generateNode(LabelFilter, `{}|label = ""`);
    expect(formatLabelFilter(MOCK_NODE, `{}|label = ""`)).toBe(`| label=""`);
  });

  it('formatLineFormatExpr should return formatted line format expr', () => {
    const MOCK_NODE = generateNode(LineFormatExpr, `{}|line_format""`);
    expect(formatLineFormatExpr(MOCK_NODE, `{}|line_format""`)).toBe(`| line_format ""`);
  });

  it('formatLabelFormatExpr should return formatted label format expr', () => {
    const MOCK_NODE = generateNode(LabelFormatExpr, `{}|label_format label="",label=""`);
    expect(formatLabelFormatExpr(MOCK_NODE, `{}|label_format label="",label=""`)).toBe(
      `| label_format label="", label=""`
    );
  });

  it('formatDistinctFilter should return formatted label format expr', () => {
    const MOCK_NODE = generateNode(DistinctFilter, `{}|distinct label,label,label`);
    expect(formatDistinctFilter(MOCK_NODE, `{}|distinct label,label,label`)).toBe(`| distinct label, label, label`);
  });

  it('formatDecolorizeExpr should return formatted label format expr', () => {
    const MOCK_NODE = generateNode(DecolorizeExpr, `{}|decolorize`);
    expect(formatDecolorizeExpr(MOCK_NODE, `{}|decolorize`)).toBe(`| decolorize`);
  });
});

describe('utility functions', () => {
  it('indent should return the correct number of spaces', () => {
    expect(indent(1)).toBe('  ');
    expect(indent(2)).toBe('    ');
  });

  it('indentMultiline should return the correct number of spaces', () => {
    expect(indentMultiline('level one', 1)).toBe('  level one');
    expect(indentMultiline('level one\n  level two\n    level three', 1)).toBe(
      '  level one\n    level two\n      level three'
    );
  });

  it('trimMultiline should return the the query stripped of whitespace', () => {
    expect(trimMultiline('{label=""} ')).toBe('{label=""}');
    expect(
      trimMultiline(
        'rate( \n  {compose_project="tns-custom"}  \n    |= "hiii" != "byeee"    \n    | logfmt \n    | lvl="e"    \n  [1s] \n)'
      )
    ).toBe('rate(\n  {compose_project="tns-custom"}\n    |= "hiii" != "byeee"\n    | logfmt\n    | lvl="e"\n  [1s]\n)');
  });

  it('needsBrackets should return true if the expression needs brackets', () => {
    const MOCK_QUERY_TYPE_LOG = 35;
    const MOCK_QUERY_TYPE_METRIC = 76;
    const MOCK_NODE_LOG = {
      firstChild: { type: { id: 35 } },
    } as SyntaxNode;

    expect(needsBrackets(MOCK_NODE_LOG, MOCK_QUERY_TYPE_LOG)).toEqual({
      addBrackets: true,
      newNode: { type: { id: 35 } },
    });
    expect(needsBrackets(MOCK_NODE_LOG, MOCK_QUERY_TYPE_METRIC)).toEqual({
      addBrackets: false,
      newNode: MOCK_NODE_LOG,
    });
  });

  it('iterateNode returns all child nodes that are in the lookingFor array', () => {
    expect(iterateNode(MOCK_NODE_ITERATOR, [LineFilter, BytesFilter]).length).toBe(2);
    expect(iterateNode(MOCK_NODE_ITERATOR, [PipelineExpr, BinOpExpr])).toEqual([
      {
        type: { id: PipelineExpr },
        firstChild: {
          type: { id: LabelFilter },
          firstChild: {
            type: { id: LineFilter },
            firstChild: {
              type: { id: Regexp },
              firstChild: {
                type: { id: BytesFilter },
                firstChild: {
                  type: { id: RangeAggregationExpr },
                  firstChild: {
                    type: { id: BinOpExpr },
                    firstChild: undefined,
                  },
                },
              },
            },
          },
        },
      },
      {
        type: { id: BinOpExpr },
        firstChild: undefined,
      },
    ]);
  });

  it('buildResponse should correcly return newlines based on lastPipelineType', () => {
    const MOCK_PIPELINE_TYPE_1 = 35;
    const MOCK_PIPELINE_TYPE_2 = 36;
    expect(buildResponse(MOCK_PIPELINE_TYPE_1, MOCK_PIPELINE_TYPE_1, '|= ""')).toBe(' |= ""');
    expect(buildResponse(MOCK_PIPELINE_TYPE_1, MOCK_PIPELINE_TYPE_2, '|= ""')).toBe('\n  |= ""');
  });
});

function generateNode(type: number, query: string): SyntaxNode {
  const tree = parser.parse(query);
  let lookingFor: SyntaxNode = {} as SyntaxNode;

  tree.iterate({
    enter: (ref): false | void => {
      const node = ref.node;
      if (node.type.id === type) {
        lookingFor = node;
        return false;
      }
    },
  });

  return lookingFor;
}

const MOCK_NODE_ITERATOR = {
  firstChild: {
    type: { id: Matcher },
    firstChild: {
      type: { id: PipelineExpr },
      firstChild: {
        type: { id: LabelFilter },
        firstChild: {
          type: { id: LineFilter },
          firstChild: {
            type: { id: Regexp },
            firstChild: {
              type: { id: BytesFilter },
              firstChild: {
                type: { id: RangeAggregationExpr },
                firstChild: {
                  type: { id: BinOpExpr },
                  firstChild: undefined,
                },
              },
            },
          },
        },
      },
    },
  },
} as unknown as SyntaxNode;
