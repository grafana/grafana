import { find, map } from 'lodash';

import { ScopedVars } from '@grafana/data';
import { EditorMode } from '@grafana/experimental';
import { TemplateSrv } from '@grafana/runtime';

import { SQLQuery } from '../sql/types';

export default class MySQLQueryModel {
  target: SQLQuery;
  templateSrv: any;
  scopedVars: any;

  constructor(target: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars) {
    this.target = target;
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;

    target.format = target.format || 'time_series';
    // target.timeColumn = target.timeColumn || 'time';
    // target.metricColumn = target.metricColumn || 'none';

    if (target.sql === undefined) {
      target.sql = {};
    }
    target.sql.groupBy = target.sql.groupBy || [];
    target.sql.filters = target.sql.filters || [];
    target.sql.columns = target.sql.columns || [];
    // target.group = target.group || [];
    // target.where = target.where || [{ type: 'macro', name: '$__timeFilter', params: [] }];
    // target.select = target.select || [[{ type: 'column', params: ['value'] }]];

    // handle pre query gui panels gracefully
    // if (!('rawQuery' in this.target)) {
    //   if ('rawSql' in target) {
    //     // pre query gui panel
    //     target.rawQuery = true;
    //   } else {
    //     // new panel
    //     target.rawQuery = false;
    //   }
    // }

    // give interpolateQueryStr access to this
    // this.interpolateQueryStr = this.interpolateQueryStr.bind(this);
  }

  // remove identifier quoting from identifier to use in metadata queries
  unquoteIdentifier(value: string) {
    if (value[0] === '"' && value[value.length - 1] === '"') {
      return value.substring(1, value.length - 1).replace(/""/g, '"');
    } else {
      return value;
    }
  }

  quoteIdentifier(value: string) {
    return '"' + value.replace(/"/g, '""') + '"';
  }

  quoteLiteral(value: string) {
    return "'" + value.replace(/'/g, "''") + "'";
  }

  escapeLiteral(value: any) {
    return String(value).replace(/'/g, "''");
  }

  hasTimeGroup() {
    // return find(this.target.group, (g: any) => g.type === 'time');
    return find(this.target.sql?.groupBy, (g: any) => g.type === 'time');
  }

  hasMetricColumn() {
    // return this.target.metricColumn !== 'none';
    // TODO
    return false;
  }

  interpolateQueryStr = (value: string, variable: { multi: any; includeAll: any }, defaultFormatFn: any) => {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return this.escapeLiteral(value);
    }

    if (typeof value === 'string') {
      return this.quoteLiteral(value);
    }

    const escapedValues = map(value, this.quoteLiteral);
    return escapedValues.join(',');
  };

  render(interpolate?: boolean) {
    const target = this.target;

    // TODO: should we store table on SQLExpression (SQLQuery.sql.table) instead of SQLQuery.table
    // if (target.editorMode === EditorMode.Builder && target.sql?.from === undefined) {
    if (target.editorMode === EditorMode.Builder && target.table === undefined) {
      return '';
    }

    // new query with no table set yet
    if (!this.target.rawSql && !this.target.table) {
      return '';
    }

    // if (!target.rawQuery) {
    //   target.rawSql = this.buildQuery();
    // }

    if (!target.rawSql) {
      target.rawSql = this.buildQuery();
    }

    if (interpolate) {
      return this.templateSrv.replace(target.rawSql, this.scopedVars, this.interpolateQueryStr);
    } else {
      return target.rawSql;
    }
  }

  hasUnixEpochTimecolumn() {
    // return ['int', 'bigint', 'double'].indexOf(this.target.timeColumnType) > -1;
    return false; // TODO
  }

  buildTimeColumn(alias = true) {
    //const timeGroup = this.hasTimeGroup();
    let query;
    //let macro = '$__timeGroup';

    // TODO
    // if (timeGroup) {
    //   let args;
    //   if (timeGroup.params.length > 1 && timeGroup.params[1] !== 'none') {
    //     args = timeGroup.params.join(',');
    //   } else {
    //     args = timeGroup.params[0];
    //   }
    //   if (this.hasUnixEpochTimecolumn()) {
    //     macro = '$__unixEpochGroup';
    //   }
    //   if (alias) {
    //     macro += 'Alias';
    //   }
    //   query = macro + '(' + this.target.timeColumn + ',' + args + ')';
    // } else {
    //   query = this.target.timeColumn;
    //   if (alias) {
    //     query += ' AS "time"';
    //   }
    // }

    return query;
  }

  buildMetricColumn() {
    // TODO
    // if (this.hasMetricColumn()) {
    //   return this.target.metricColumn + ' AS metric';
    // }

    return '';
  }

  buildValueColumns() {
    let query = '';
    // TODO
    // for (const column of this.target.select) {
    //   query += ',\n  ' + this.buildValueColumn(column);
    // }

    return query;
  }

  buildValueColumn(column: any) {
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
      query += ' AS ' + this.quoteIdentifier(alias.params[0]);
    }

    return query;
  }

  buildWhereClause() {
    let query = '';
    // TODO
    // const conditions = map(this.target.where, (tag, index) => {
    //   switch (tag.type) {
    //     case 'macro':
    //       return tag.name + '(' + this.target.timeColumn + ')';
    //       break;
    //     case 'expression':
    //       return tag.params.join(' ');
    //       break;
    //   }
    // });

    // if (conditions.length > 0) {
    //   query = '\nWHERE\n  ' + conditions.join(' AND\n  ');
    // }

    return query;
  }

  buildGroupClause() {
    let query = '';
    let groupSection = '';

    // TODO
    // for (let i = 0; i < this.target.group.length; i++) {
    //   const part = this.target.group[i];
    //   if (i > 0) {
    //     groupSection += ', ';
    //   }
    //   if (part.type === 'time') {
    //     groupSection += '1';
    //   } else {
    //     groupSection += part.params[0];
    //   }
    // }

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

    query += '\nORDER BY ' + this.buildTimeColumn(false);

    return query;
  }

  getDatabase() {
    return this.target.dataset;
  }
}
