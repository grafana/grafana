import { monacoTypes } from '@grafana/ui';

export interface TestQueryModel {
  query: string;
  tokens: Array<Array<Pick<monacoTypes.Token, 'language' | 'offset' | 'type'>>>;
}

export interface StatementPositionResolverTestCase {
  query: TestQueryModel;
  position: { line: number; column: number };
}
