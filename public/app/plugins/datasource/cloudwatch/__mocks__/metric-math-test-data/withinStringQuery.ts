import { monacoTypes } from '@grafana/ui';

export const withinStringQuery = {
  query: "SEARCH('a ')",
  tokens: [
    [
      { offset: 0, type: 'predefined.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 6, type: 'delimiter.parenthesis.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 7, type: 'string.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 9, type: 'white.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 10, type: 'string.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 11, type: 'delimiter.parenthesis.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
    ],
  ] as monacoTypes.Token[][],
  position: {
    lineNumber: 1,
    column: 11,
  },
};
