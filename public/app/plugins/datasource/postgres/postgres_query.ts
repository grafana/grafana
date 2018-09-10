import _ from 'lodash';

export default class PostgresQuery {
  target: any;
  templateSrv: any;
  scopedVars: any;

  /** @ngInject */
  constructor(target, templateSrv?, scopedVars?) {
    this.target = target;
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;

    target.format = target.format || 'time_series';
    target.timeColumn = target.timeColumn || 'time';
    target.metricColumn = target.metricColumn || 'none';

    target.group = target.group || [];
    target.where = target.where || [{ type: 'macro', name: '$__timeFilter', params: [] }];
    target.select = target.select || [[{ type: 'column', params: ['value'] }]];

    // handle pre query gui panels gracefully
    if (!('rawQuery' in this.target)) {
      if ('rawSql' in target) {
        // pre query gui panel
        target.rawQuery = true;
      } else {
        // new panel
        target.rawQuery = false;
      }
    }

    // give interpolateQueryStr access to this
    this.interpolateQueryStr = this.interpolateQueryStr.bind(this);
  }

  // remove identifier quoting from identifier to use in metadata queries
  unquoteIdentifier(value) {
    if (value[0] === '"' && value[value.length - 1] === '"') {
      return value.substring(1, value.length - 1).replace(/""/g, '"');
    } else {
      return value;
    }
  }

  quoteIdentifier(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  quoteLiteral(value) {
    return "'" + String(value).replace(/'/g, "''") + "'";
  }

  escapeLiteral(value) {
    return String(value).replace(/'/g, "''");
  }

  hasTimeGroup() {
    return _.find(this.target.group, (g: any) => g.type === 'time');
  }

  hasMetricColumn() {
    return this.target.metricColumn !== 'none';
  }

  interpolateQueryStr(value, variable, defaultFormatFn) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return this.escapeLiteral(value);
    }

    if (typeof value === 'string') {
      return this.quoteLiteral(value);
    }

    const escapedValues = _.map(value, this.quoteLiteral);
    return escapedValues.join(',');
  }

  render(interpolate?) {
    const target = this.target;

    // new query with no table set yet
    if (!this.target.rawQuery && !('table' in this.target)) {
      return '';
    }

    if (!target.rawQuery) {
      target.rawSql = this.buildQuery();
    }

    if (interpolate) {
      return this.templateSrv.replace(target.rawSql, this.scopedVars, this.interpolateQueryStr);
    } else {
      return target.rawSql;
    }
  }

  hasUnixEpochTimecolumn() {
    return ['int4', 'int8', 'float4', 'float8', 'numeric'].indexOf(this.target.timeColumnType) > -1;
  }

  buildTimeColumn(alias = true) {
    const timeGroup = this.hasTimeGroup();
    let query;
    let macro = '$__timeGroup';

    if (timeGroup) {
      let args;
      if (timeGroup.params.length > 1 && timeGroup.params[1] !== 'none') {
        args = timeGroup.params.join(',');
      } else {
        args = timeGroup.params[0];
      }
      if (this.hasUnixEpochTimecolumn()) {
        macro = '$__unixEpochGroup';
      }
      if (alias) {
        macro += 'Alias';
      }
      query = macro + '(' + this.target.timeColumn + ',' + args + ')';
    } else {
      query = this.target.timeColumn;
      if (alias) {
        query += ' AS "time"';
      }
    }

    return query;
  }

  buildMetricColumn() {
    if (this.hasMetricColumn()) {
      return this.target.metricColumn + ' AS metric';
    }

    return '';
  }

  buildValueColumns() {
    let query = '';
    for (const column of this.target.select) {
      query += ',\n  ' + this.buildValueColumn(column);
    }

    return query;
  }

  buildValueColumn(column) {
    let query = '';

    const columnName = _.find(column, (g: any) => g.type === 'column');
    query = columnName.params[0];

    const aggregate = _.find(column, (g: any) => g.type === 'aggregate' || g.type === 'percentile');
    const windows = _.find(column, (g: any) => g.type === 'window' || g.type === 'moving_window');

    if (aggregate) {
      const func = aggregate.params[0];
      switch (aggregate.type) {
        case 'aggregate':
          if (func === 'first' || func === 'last') {
            query = func + '(' + query + ',' + this.target.timeColumn + ')';
          } else {
            query = func + '(' + query + ')';
          }
          break;
        case 'percentile':
          query = func + '(' + aggregate.params[1] + ') WITHIN GROUP (ORDER BY ' + query + ')';
          break;
      }
    }

    if (windows) {
      const overParts = [];
      if (this.hasMetricColumn()) {
        overParts.push('PARTITION BY ' + this.target.metricColumn);
      }
      overParts.push('ORDER BY ' + this.buildTimeColumn(false));

      const over = overParts.join(' ');
      let curr: string;
      let prev: string;
      switch (windows.type) {
        case 'window':
          switch (windows.params[0]) {
            case 'increase':
              curr = query;
              prev = 'lag(' + curr + ') OVER (' + over + ')';
              query = '(CASE WHEN ' + curr + ' >= ' + prev + ' THEN ' + curr + ' - ' + prev;
              query += ' WHEN ' + prev + ' IS NULL THEN NULL ELSE ' + curr + ' END)';
              break;
            case 'rate':
              let timeColumn = this.target.timeColumn;
              if (aggregate) {
                timeColumn = 'min(' + timeColumn + ')';
              }

              curr = query;
              prev = 'lag(' + curr + ') OVER (' + over + ')';
              query = '(CASE WHEN ' + curr + ' >= ' + prev + ' THEN ' + curr + ' - ' + prev;
              query += ' WHEN ' + prev + ' IS NULL THEN NULL ELSE ' + curr + ' END)';
              query += '/extract(epoch from ' + timeColumn + ' - lag(' + timeColumn + ') OVER (' + over + '))';
              break;
            default:
              query = windows.params[0] + '(' + query + ') OVER (' + over + ')';
              break;
          }
          break;
        case 'moving_window':
          query = windows.params[0] + '(' + query + ') OVER (' + over + ' ROWS ' + windows.params[1] + ' PRECEDING)';
          break;
      }
    }

    const alias = _.find(column, (g: any) => g.type === 'alias');
    if (alias) {
      query += ' AS ' + this.quoteIdentifier(alias.params[0]);
    }

    return query;
  }

  buildWhereClause() {
    let query = '';
    const conditions = _.map(this.target.where, (tag, index) => {
      switch (tag.type) {
        case 'macro':
          return tag.name + '(' + this.target.timeColumn + ')';
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
  }

  buildGroupClause() {
    let query = '';
    let groupSection = '';

    for (let i = 0; i < this.target.group.length; i++) {
      const part = this.target.group[i];
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
      if (this.hasMetricColumn()) {
        query += ',2';
      }
    }
    return query;
  }

  buildQuery() {
    let query = 'SELECT';

    query += '\n  ' + this.buildTimeColumn();
    if (this.hasMetricColumn()) {
      query += ',\n  ' + this.buildMetricColumn();
    }
    query += this.buildValueColumns();

    query += '\nFROM ' + this.target.table;

    query += this.buildWhereClause();
    query += this.buildGroupClause();

    query += '\nORDER BY 1';
    if (this.hasMetricColumn()) {
      query += ',2';
    }

    return query;
  }
}
