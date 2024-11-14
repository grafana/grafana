import { monacoTypes } from '@grafana/ui';

export const insideLabelValue = {
  query: '${DATAPOINT_COUNT} ',
  tokens: [
    [
      {
        offset: 0,
        type: 'predefined.cloudwatch-dynamicLabels',
        language: 'cloudwatch-dynamicLabels',
      },
      {
        offset: 18,
        type: 'white.cloudwatch-dynamicLabels',
        language: 'cloudwatch-dynamicLabels',
      },
    ],
  ] as monacoTypes.Token[][],
  position: {
    lineNumber: 1,
    column: 10,
  },
};
