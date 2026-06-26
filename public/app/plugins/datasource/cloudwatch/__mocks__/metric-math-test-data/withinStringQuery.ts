import { monacoTypes } from '@grafana/ui';

export const withinStringQuery = {
  query: `SEARCH(' {"Custom-Namespace", "Dimension Name With Spaces"}, `,
  tokens: [
    [
      { offset: 0, type: 'predefined.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 6, type: 'delimiter.parenthesis.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 7, type: 'string.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 8, type: 'white.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 9, type: 'delimiter.curly.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 10, type: 'type.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 28, type: 'source.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 30, type: 'type.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 58, type: 'delimiter.curly.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 59, type: 'delimiter.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
      { offset: 60, type: 'white.cloudwatch-MetricMath', language: 'cloudwatch-MetricMath' },
    ],
  ] as monacoTypes.Token[][],
  position: {
    lineNumber: 1,
    column: 62,
  },
};
