import { monacoTypes } from '@grafana/ui';

export const afterFunctionQuery = {
  query: 'AVG() ',
  tokens: [
    [
      {
        offset: 0,
        type: 'predefined.cloudwatch-MetricMath',
        language: 'cloudwatch-MetricMath',
      },
      {
        offset: 3,
        type: 'delimiter.parenthesis.cloudwatch-MetricMath',
        language: 'cloudwatch-MetricMath',
      },
      {
        offset: 5,
        type: 'white.cloudwatch-MetricMath',
        language: 'cloudwatch-MetricMath',
      },
    ],
  ] as monacoTypes.Token[][],
  position: {
    lineNumber: 1,
    column: 7,
  },
};
