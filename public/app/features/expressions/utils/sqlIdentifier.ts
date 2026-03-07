import { quoteIdentifierIfNecessary, unquoteIdentifier } from 'app/plugins/datasource/mysql/sqlUtil';

export function quoteTableIdentifierIfNecessary(value: string) {
  return quoteIdentifierIfNecessary(unquoteIdentifier(value));
}
