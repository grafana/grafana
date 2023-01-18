import { isEmpty } from 'lodash';

import { SQLQuery } from 'app/features/plugins/sql/types';
import { createSelectClause, escapeValue, haveColumns } from 'app/features/plugins/sql/utils/sql.utils';

export function toRawSql({ sql, dataset, table }: SQLQuery, escapeIdentifiers?: boolean): string {
  let rawQuery = '';

  // Return early with empty string if there is no sql column
  if (!sql || !haveColumns(sql.columns)) {
    return rawQuery;
  }

  rawQuery += createSelectClause(sql.columns, escapeIdentifiers);

  if (dataset && table) {
    rawQuery += `FROM ${escapeValue(dataset, escapeIdentifiers)}.${escapeValue(table, escapeIdentifiers)} `;
  }

  if (sql.whereString) {
    rawQuery += `WHERE ${sql.whereString} `;
  }

  if (sql.groupBy?.[0]?.property.name) {
    const groupBy = sql.groupBy
      .map((g) => g.property.name)
      .filter((g) => !isEmpty(g))
      .map((g) => escapeValue(g, escapeIdentifiers));
    rawQuery += `GROUP BY ${groupBy.join(', ')} `;
  }

  if (sql.orderBy?.property.name) {
    rawQuery += `ORDER BY ${escapeValue(sql.orderBy.property.name, escapeIdentifiers)} `;
  }

  if (sql.orderBy?.property.name && sql.orderByDirection) {
    rawQuery += `${sql.orderByDirection} `;
  }

  // Altough LIMIT 0 doesn't make sense, it is still possible to have LIMIT 0
  if (sql.limit !== undefined && sql.limit >= 0) {
    rawQuery += `LIMIT ${sql.limit} `;
  }
  return rawQuery;
}
