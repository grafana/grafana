import { isEmpty } from 'lodash';

import { createSelectClause, haveColumns, RAQBFieldTypes, SQLQuery } from '@grafana/sql';

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
