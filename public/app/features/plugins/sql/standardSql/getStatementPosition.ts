import { Registry } from '@grafana/data';

import { StatementPosition, TokenType } from '../types';
import { LinkedToken } from '../utils/LinkedToken';

import { StatementPositionResolversRegistryItem } from './types';

// Given current cursor position in the SQL editor, returns the statement position.
export function getStatementPosition(
  currentToken: LinkedToken | null,
  statementPositionResolversRegistry: Registry<StatementPositionResolversRegistryItem>
): StatementPosition[] {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const previousKeyword = currentToken?.getPreviousKeyword();
  const previousIsSlash = currentToken?.getPreviousNonWhiteSpaceToken()?.is(TokenType.Operator, '/');
  const resolvers = statementPositionResolversRegistry.list();
  const positions = [];

  for (const resolver of resolvers) {
    if (
      resolver.resolve(currentToken, previousKeyword ?? null, previousNonWhiteSpace ?? null, Boolean(previousIsSlash))
    ) {
      positions.push(resolver.id);
    }
  }

  if (positions.length === 0) {
    return [StatementPosition.Unknown];
  }
  return positions;
}
