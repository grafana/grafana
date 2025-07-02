import { monacoTypes } from '@grafana/ui';

export const singleLineEmptyQuery = {
  query: '',
  tokens: [] as monacoTypes.Token[][],
  position: {
    lineNumber: 1,
    column: 1,
  },
};
