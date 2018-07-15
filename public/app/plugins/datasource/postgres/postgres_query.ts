import _ from 'lodash';

export default class PostgresQuery {
  target: any;
  queryBuilder: any;
  templateSrv: any;
  scopedVars: any;

  /** @ngInject */
  constructor(target, templateSrv?, scopedVars?) {
    this.target = target;
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;

    target.schema = target.schema || 'public';
    target.format = target.format || 'time_series';
    target.timeColumn = target.timeColumn || 'time';
    target.metricColumn = target.metricColumn || 'none';

    target.groupBy = target.groupBy || [];
    target.where = target.where || [];
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
      return value.substring(1, value.length - 1).replace('""', '"');
    } else {
      return value;
    }
  }

  quoteIdentifier(value) {
    return '"' + value.replace('"', '""') + '"';
  }

  quoteLiteral(value) {
    return "'" + value.replace("'", "''") + "'";
  }

  hasGroupByTime() {
    return _.find(this.target.groupBy, (g: any) => g.type === 'time');
  }

  hasMetricColumn() {
    return this.target.metricColumn !== 'none';
  }

  interpolateQueryStr(value, variable, defaultFormatFn) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return value;
    }

    if (typeof value === 'string') {
      return this.quoteLiteral(value);
    }

    let escapedValues = _.map(value, this.quoteLiteral);
    return '(' + escapedValues.join(',') + ')';
  }

  render(interpolate?) {
    let target = this.target;
    let query;

    if (target.rawQuery) {
      if (interpolate) {
        return this.templateSrv.replace(target.rawSql, this.scopedVars, this.interpolateQueryStr);
      } else {
        return target.rawSql;
      }
    }

    query = this.buildQuery();
    if (interpolate) {
      query = this.templateSrv.replace(query, this.scopedVars, this.interpolateQueryStr);
    }
    this.target.rawSql = query;
    return query;
  }

  buildTimeColumn() {
    let timeGroup = this.hasGroupByTime();
    let query;

    if (timeGroup) {
      let args;
      if (timeGroup.params.length > 1 && timeGroup.params[1] !== 'none') {
        args = timeGroup.params.join(',');
      } else {
        args = timeGroup.params[0];
      }
      query = '$__timeGroup(' + this.target.timeColumn + ',' + args + ')';
    } else {
      query = this.target.timeColumn + ' AS "time"';
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
    for (let column of this.target.select) {
      query += ',\n  ' + this.buildValueColumn(column);
    }

    return query;
  }

  buildValueColumn(column) {
    let query = '';

    let columnName = _.find(column, (g: any) => g.type === 'column');
    query = columnName.params[0];

    let aggregate = _.find(column, (g: any) => g.type === 'aggregate');
    if (aggregate) {
      query = aggregate.params[0] + '(' + query + ')';
    }

    let special = _.find(column, (g: any) => g.type === 'special');
    if (special) {
      let over = '';
      if (this.hasMetricColumn()) {
        over = 'PARTITION BY ' + this.target.metricColumn;
      }
      switch (special.params[0]) {
        case 'increase':
          query = query + ' - lag(' + query + ') OVER (' + over + ')';
          break;
        case 'rate':
          let timeColumn = this.target.timeColumn;
          let curr = query;
          let prev = 'lag(' + curr + ') OVER (' + over + ')';
          query = '(CASE WHEN ' + curr + ' >= ' + prev + ' THEN ' + curr + ' - ' + prev + ' ELSE ' + curr + ' END)';
          query += '/extract(epoch from ' + timeColumn + ' - lag(' + timeColumn + ') OVER (' + over + '))';
          break;
      }
    }

    let alias = _.find(column, (g: any) => g.type === 'alias');
    if (alias) {
      query += ' AS ' + this.quoteIdentifier(alias.params[0]);
    }

    return query;
  }

  buildWhereClause() {
    let query = '';
    let conditions = _.map(this.target.where, (tag, index) => {
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

  buildGroupByClause() {
    let query = '';
    let groupBySection = '';

    for (let i = 0; i < this.target.groupBy.length; i++) {
      let part = this.target.groupBy[i];
      if (i > 0) {
        groupBySection += ', ';
      }
      if (part.type === 'time') {
        groupBySection += '1';
      } else {
        groupBySection += part.params[0];
      }
    }

    if (groupBySection.length) {
      query = '\nGROUP BY ' + groupBySection;
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
      query += '\n  ' + this.buildMetricColumn();
    }
    query += this.buildValueColumns();

    query += '\nFROM ' + this.target.schema + '.' + this.target.table;

    query += this.buildWhereClause();
    query += this.buildGroupByClause();

    query += '\nORDER BY 1';

    return query;
  }
}
