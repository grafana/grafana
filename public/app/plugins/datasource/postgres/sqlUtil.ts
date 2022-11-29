import { isEmpty } from 'lodash';

import { RAQBFieldTypes, SQLExpression, SQLQuery } from 'app/features/plugins/sql/types';

export function getFieldConfig(type: string): { raqbFieldType: RAQBFieldTypes; icon: string } {
  switch (type) {
    case 'boolean': {
      return { raqbFieldType: 'boolean', icon: 'toggle-off' };
    }
    case 'bit':
    case 'bit varying':
    case 'character':
    case 'character varying':
    case 'text': {
      return { raqbFieldType: 'text', icon: 'text' };
    }
    case 'smallint':
    case 'integer':
    case 'bigint':
    case 'decimal':
    case 'numeric':
    case 'real':
    case 'double precision':
    case 'serial':
    case 'bigserial':
    case 'smallserial': {
      return { raqbFieldType: 'number', icon: 'calculator-alt' };
    }
    case 'date': {
      return { raqbFieldType: 'date', icon: 'clock-nine' };
    }
    case 'time':
    case 'time with time zone':
    case 'time without time zone':
    case 'interval': {
      return { raqbFieldType: 'time', icon: 'clock-nine' };
    }
    case 'timestamp':
    case 'timestamp with time zone':
    case 'timestamp without time zone': {
      return { raqbFieldType: 'datetime', icon: 'clock-nine' };
    }
    default:
      return { raqbFieldType: 'text', icon: 'text' };
  }
}

export function toRawSql({ sql, table }: SQLQuery): string {
  let rawQuery = '';

  // Return early with empty string if there is no sql column
  if (!sql || !haveColumns(sql.columns)) {
    return rawQuery;
  }

  rawQuery += createSelectClause(sql.columns);

  if (table) {
    rawQuery += `FROM ${table} `;
  }

  if (sql.whereString) {
    rawQuery += `WHERE ${sql.whereString} `;
  }

  if (sql.groupBy?.[0]?.property.name) {
    const groupBy = sql.groupBy.map((g) => g.property.name).filter((g) => !isEmpty(g));
    rawQuery += `GROUP BY ${groupBy.join(', ')} `;
  }

  if (sql.orderBy?.property.name) {
    rawQuery += `ORDER BY ${sql.orderBy.property.name} `;
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

function createSelectClause(sqlColumns: NonNullable<SQLExpression['columns']>): string {
  const columns = sqlColumns.map((c) => {
    let rawColumn = '';
    if (c.name && c.alias) {
      rawColumn += `${c.name}(${c.parameters?.map((p) => `${p.name}`)}) AS ${c.alias}`;
    } else if (c.name) {
      rawColumn += `${c.name}(${c.parameters?.map((p) => `${p.name}`)})`;
    } else if (c.alias) {
      rawColumn += `${c.parameters?.map((p) => `${p.name}`)} AS ${c.alias}`;
    } else {
      rawColumn += `${c.parameters?.map((p) => `${p.name}`)}`;
    }
    return rawColumn;
  });

  return `SELECT ${columns.join(', ')} `;
}

export const haveColumns = (columns: SQLExpression['columns']): columns is NonNullable<SQLExpression['columns']> => {
  if (!columns) {
    return false;
  }

  const haveColumn = columns.some((c) => c.parameters?.length || c.parameters?.some((p) => p.name));
  const haveFunction = columns.some((c) => c.name);
  return haveColumn || haveFunction;
};
