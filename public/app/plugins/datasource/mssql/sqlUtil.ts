import { isEmpty } from 'lodash';

import { RAQBFieldTypes, SQLExpression, SQLQuery, haveColumns } from '@grafana/sql';

export function getIcon(type: string): string | undefined {
  switch (type) {
    case 'datetimeoffset':
    case 'date':
    case 'datetime2':
    case 'smalldatetime':
    case 'datetime':
    case 'time':
      return 'clock-nine';
    case 'bit':
      return 'toggle-off';
    case 'tinyint':
    case 'smallint':
    case 'int':
    case 'bigint':
    case 'decimal':
    case 'numeric':
    case 'real':
    case 'float':
    case 'money':
    case 'smallmoney':
      return 'calculator-alt';
    case 'char':
    case 'varchar':
    case 'text':
    case 'nchar':
    case 'nvarchar':
    case 'ntext':
    case 'binary':
    case 'varbinary':
    case 'image':
      return 'text';
    default:
      return undefined;
  }
}

export function getRAQBType(type: string): RAQBFieldTypes {
  switch (type) {
    case 'datetimeoffset':
    case 'datetime2':
    case 'smalldatetime':
    case 'datetime':
      return 'datetime';
    case 'time':
      return 'time';
    case 'date':
      return 'date';
    case 'bit':
      return 'boolean';
    case 'tinyint':
    case 'smallint':
    case 'int':
    case 'bigint':
    case 'decimal':
    case 'numeric':
    case 'real':
    case 'float':
    case 'money':
    case 'smallmoney':
      return 'number';
    case 'char':
    case 'varchar':
    case 'text':
    case 'nchar':
    case 'nvarchar':
    case 'ntext':
    case 'binary':
    case 'varbinary':
    case 'image':
      return 'text';
    default:
      return 'text';
  }
}

export function toRawSql({ sql, dataset, table }: SQLQuery): string {
  let rawQuery = '';

  // Return early with empty string if there is no sql column
  if (!sql || !haveColumns(sql.columns)) {
    return rawQuery;
  }

  rawQuery += createSelectClause(sql.columns, sql.limit);

  if (dataset && table) {
    rawQuery += `FROM [${dataset}].${table} `;
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

  return rawQuery;
}

function createSelectClause(sqlColumns: NonNullable<SQLExpression['columns']>, limit?: number): string {
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
  return `SELECT ${isLimit(limit) ? 'TOP(' + limit + ')' : ''} ${columns.join(', ')} `;
}

const isLimit = (limit: number | undefined): boolean => limit !== undefined && limit >= 0;
