import { find, map } from 'lodash';
import { DataQuery } from '@grafana/data';

export const quoteLiteral = (value: any): string => {
  return String(value).replace(/'/g, "''");
};

export const buildQuery = (target: DataQuery): string => {
  let query = 'SELECT';

  query += '\n  ' + buildTimeColumn(target);
  if (hasMetricColumn(target)) {
    query += ',\n  ' + buildMetricColumn(target);
  }
  query += buildValueColumns(target);

  query += '\nFROM ' + (target as any).table;

  query += buildWhereClause(target);
  query += buildGroupClause(target);

  query += '\nORDER BY ' + buildTimeColumn(target, false);

  return query;
};

const buildTimeColumn = (target: DataQuery, alias = true): string => {
  const timeGroup = findTimeGroup(target);
  let query;
  let macro = '$__timeGroup';

  if (timeGroup) {
    let args;
    if (timeGroup.params.length > 1 && timeGroup.params[1] !== 'none') {
      args = timeGroup.params.join(',');
    } else {
      args = timeGroup.params[0];
    }

    if (hasUnixEpochTimeColumn(target)) {
      macro = '$__unixEpochGroup';
    }
    if (alias) {
      macro += 'Alias';
    }
    query = macro + '(' + (target as any).timeColumn + ',' + args + ')';
  } else {
    query = (target as any).timeColumn;
    if (alias) {
      query += ' AS "time"';
    }
  }

  return query;
};

export const findTimeGroup = (target: DataQuery): any => {
  return find((target as any).group, (g: any) => g.type === 'time');
};

const hasMetricColumn = (target: DataQuery): boolean => {
  return (target as any).metricColumn !== 'none';
};

const buildMetricColumn = (target: DataQuery): string => {
  if (hasMetricColumn(target)) {
    return (target as any).metricColumn + ' AS metric';
  }

  return '';
};

const buildValueColumns = (target: DataQuery): string => {
  let query = '';
  for (const column of (target as any).select) {
    query += ',\n  ' + buildValueColumn(target, column);
  }

  return query;
};

const buildValueColumn = (target: DataQuery, column: any): string => {
  let query = '';

  const columnName: any = find(column, (g: any) => g.type === 'column');
  query = columnName.params[0];

  const aggregate: any = find(column, (g: any) => g.type === 'aggregate');

  if (aggregate) {
    const func = aggregate.params[0];
    query = func + '(' + query + ')';
  }

  const alias: any = find(column, (g: any) => g.type === 'alias');
  if (alias) {
    query += `AS "${alias.params[0].replace(/"/g, '""')}"`;
  }

  return query;
};

const buildWhereClause = (target: DataQuery): string => {
  let query = '';
  const conditions = map((target as any).where, (tag, index) => {
    switch (tag.type) {
      case 'macro':
        return tag.name + '(' + (target as any).timeColumn + ')';
        break;
      case 'expression':
        return tag.params.join(' ');
        break;
    }
  });

  if (conditions.length > 0) {
    query = '\nWHERE\n  ' + conditions.join(' AND\n  ');
  }

  return query;
};

const buildGroupClause = (target: DataQuery): string => {
  let query = '';
  let groupSection = '';
  const group = (target as any).group;

  for (let i = 0; i < group.length; i++) {
    const part = group[i];
    if (i > 0) {
      groupSection += ', ';
    }
    if (part.type === 'time') {
      groupSection += '1';
    } else {
      groupSection += part.params[0];
    }
  }

  if (groupSection.length) {
    query = '\nGROUP BY ' + groupSection;
    if (hasMetricColumn(target)) {
      query += ',2';
    }
  }
  return query;
};

// remove identifier quoting from identifier to use in metadata queries
export const unquoteIdentifier = (value: string): string => {
  if (value[0] === '"' && value[value.length - 1] === '"') {
    return value.substring(1, value.length - 1).replace(/""/g, '"');
  } else {
    return value;
  }
};

export const hasUnixEpochTimeColumn = (target: DataQuery): boolean => {
  return ['int', 'bigint', 'double'].indexOf((target as any).timeColumnType) > -1;
};
