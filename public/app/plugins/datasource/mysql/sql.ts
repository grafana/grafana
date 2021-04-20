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

  query += '\nFROM ' + target.table;

  query += buildWhereClause(target);
  query += buildGroupClause(target);

  query += '\nORDER BY ' + buildTimeColumn(target, false);

  return query;
};

const buildTimeColumn = (target: DataQuery, alias = true): string => {
  const timeGroup = hasTimeGroup(target);
  let query;
  let macro = '$__timeGroup';

  if (timeGroup) {
    let args;
    if (timeGroup.params.length > 1 && timeGroup.params[1] !== 'none') {
      args = timeGroup.params.join(',');
    } else {
      args = timeGroup.params[0];
    }

    if (['int', 'bigint', 'double'].indexOf(target.timeColumnType) > -1) {
      macro = '$__unixEpochGroup';
    }
    if (alias) {
      macro += 'Alias';
    }
    query = macro + '(' + target.timeColumn + ',' + args + ')';
  } else {
    query = target.timeColumn;
    if (alias) {
      query += ' AS "time"';
    }
  }

  return query;
};

export const hasTimeGroup = (target: DataQuery): bool => {
  return _.find(target.group, (g: any) => g.type === 'time');
};

const hasMetricColumn = (target: DataQuery): bool => {
  return target.metricColumn !== 'none';
};

const buildMetricColumn = (target: DataQuery): string => {
  if (hasMetricColumn(target)) {
    return target.metricColumn + ' AS metric';
  }

  return '';
};

const buildValueColumns = (target: DataQuery): string => {
  let query = '';
  for (const column of target.select) {
    query += ',\n  ' + buildValueColumn(target, column);
  }

  return query;
};

const buildValueColumn = (target: DataQuery, column: any): string => {
  let query = '';

  const columnName: any = _.find(column, (g: any) => g.type === 'column');
  query = columnName.params[0];

  const aggregate: any = _.find(column, (g: any) => g.type === 'aggregate');

  if (aggregate) {
    const func = aggregate.params[0];
    query = func + '(' + query + ')';
  }

  const alias: any = _.find(column, (g: any) => g.type === 'alias');
  if (alias) {
    query += `AS "${alias.params[0].replace(/"/g, '""')}"`;
  }

  return query;
};

const buildWhereClause = (target: DataQuery): string => {
  let query = '';
  const conditions = _.map(target.where, (tag, index) => {
    switch (tag.type) {
      case 'macro':
        return tag.name + '(' + target.timeColumn + ')';
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

  for (let i = 0; i < target.group.length; i++) {
    const part = target.group[i];
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
