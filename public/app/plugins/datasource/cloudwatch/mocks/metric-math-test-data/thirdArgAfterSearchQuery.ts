import { monacoTypes } from '@grafana/ui';

export const thirdArgAfterSearchQuery = {
  query: "SEARCH('stuff', 'Average', )",
  tokens: [
    [
      { offset: 0, type: 'predefined.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 6, type: 'delimiter.parenthesis.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 7, type: 'string.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 14, type: 'delimiter.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 15, type: 'white.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 16, type: 'string.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 25, type: 'delimiter.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 26, type: 'white.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 27, type: 'delimiter.parenthesis.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
    ],
  ] as monacoTypes.Token[][],
  position: {
    lineNumber: 1,
    column: 28,
  },
};
