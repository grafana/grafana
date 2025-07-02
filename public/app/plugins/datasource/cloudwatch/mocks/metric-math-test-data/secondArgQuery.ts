import { monacoTypes } from '@grafana/ui';

export const secondArgQuery = {
  query: 'FILL($first, )',
  tokens: [
    [
      { offset: 0, type: 'predefined.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 4, type: 'delimiter.parenthesis.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 5, type: 'variable.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 11, type: 'delimiter.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 12, type: 'white.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 13, type: 'delimiter.parenthesis.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
    ],
  ] as monacoTypes.Token[][],
  position: {
    lineNumber: 1,
    column: 14,
  },
};
