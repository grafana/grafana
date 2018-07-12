import _ from 'lodash';
import sqlPart from './sql_part';

export default class PostgresQuery {
  target: any;
  selectModels: any[];
  queryBuilder: any;
  groupByParts: any[];
  whereParts: any[];
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
    target.metricColumn = target.metricColumn || 'None';

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

    this.updateProjection();
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

  updateProjection() {
    this.selectModels = _.map(this.target.select, function(parts: any) {
      return _.map(parts, sqlPart.create).filter(n => n);
    });
    this.whereParts = _.map(this.target.where, sqlPart.create).filter(n => n);
    this.groupByParts = _.map(this.target.groupBy, sqlPart.create).filter(n => n);
  }

  updatePersistedParts() {
    this.target.select = _.map(this.selectModels, function(selectParts) {
      return _.map(selectParts, function(part: any) {
        return { type: part.def.type, params: part.params };
      });
    });
    this.target.where = _.map(this.whereParts, function(part: any) {
      return { type: part.def.type, name: part.name, params: part.params };
    });
    this.target.groupBy = _.map(this.groupByParts, function(part: any) {
      return { type: part.def.type, params: part.params };
    });
  }

  hasGroupByTime() {
    return _.find(this.target.groupBy, (g: any) => g.type === 'time');
  }

  addGroupBy(partType, value) {
    let partModel = sqlPart.create({ type: partType, params: [value] });
    let partCount = this.target.groupBy.length;

    if (partCount === 0) {
      this.target.groupBy.push(partModel.part);
    } else if (partType === 'time') {
      // put timeGroup at start
      this.target.groupBy.splice(0, 0, partModel.part);
    } else {
      this.target.groupBy.push(partModel.part);
    }

    if (partType === 'time') {
      partModel.part.params = ['1m', 'none'];
    }

    // add aggregates when adding group by
    for (let i = 0; i < this.target.select.length; i++) {
      var selectParts = this.target.select[i];
      if (!selectParts.some(part => part.type === 'aggregate')) {
        selectParts.splice(1, 0, { type: 'aggregate', params: ['avg'] });
        if (!selectParts.some(part => part.type === 'alias')) {
          selectParts.push({ type: 'alias', params: [selectParts[0].params[0]] });
        }
      }
    }

    this.updateProjection();
  }

  removeGroupByPart(part, index) {
    if (part.def.type === 'time') {
      // remove aggregations
      this.target.select = _.map(this.target.select, (s: any) => {
        return _.filter(s, (part: any) => {
          if (part.type === 'aggregate') {
            return false;
          }
          return true;
        });
      });
    }

    this.target.groupBy.splice(index, 1);
    this.updateProjection();
  }

  removeSelectPart(selectParts, part) {
    // if we remove the field remove the whole statement
    if (part.def.type === 'column') {
      if (this.selectModels.length > 1) {
        let modelsIndex = _.indexOf(this.selectModels, selectParts);
        this.selectModels.splice(modelsIndex, 1);
      }
    } else {
      let partIndex = _.indexOf(selectParts, part);
      selectParts.splice(partIndex, 1);
    }

    this.updatePersistedParts();
  }

  addSelectPart(selectParts, type) {
    let partModel = sqlPart.create({ type: type });
    partModel.def.addStrategy(selectParts, partModel, this);
    this.updatePersistedParts();
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

    query = this.buildQuery(target);
    if (interpolate) {
      query = this.templateSrv.replace(query, this.scopedVars, this.interpolateQueryStr);
    }
    this.target.rawSql = query;
    return query;
  }

  buildTimeColumn(target) {
    let timeGroup = this.hasGroupByTime();
    let query;

    if (timeGroup) {
      let args;
      if (timeGroup.params.length > 1 && timeGroup.params[1] !== 'none') {
        args = timeGroup.params.join(',');
      } else {
        args = timeGroup.params[0];
      }
      query = '$__timeGroup(' + target.timeColumn + ',' + args + ')';
    } else {
      query = target.timeColumn + ' AS "time"';
    }

    return query;
  }

  buildMetricColumn(target) {
    let query = '';

    if (this.target.metricColumn !== 'None') {
      query += ',' + this.target.metricColumn + ' AS metric';
    }

    return query;
  }

  buildValueColumns(target) {
    let query = '';
    for (let i = 0; i < target.select.length; i++) {
      query += ', ' + this.buildValueColumn(target, target.select[i]);
    }

    return query;
  }

  buildValueColumn(target, column) {
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
      if (target.metricColumn) {
        over = 'PARTITION BY ' + target.metricColumn;
      }
      switch (special.params[0]) {
        case 'increase':
          query = query + ' - lag(' + query + ') OVER ()';
          break;
        case 'rate':
          let timeColumn = target.timeColumn;
          query = '(' + query + ' - lag(' + query + ') OVER (' + over + '))';
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

  buildWhereClause(target) {
    let query = '';
    let conditions = _.map(target.where, (tag, index) => {
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
      query = ' WHERE ' + conditions.join(' AND ');
    }

    return query;
  }

  buildGroupByClause(target) {
    let query = '';
    let groupBySection = '';

    for (let i = 0; i < this.groupByParts.length; i++) {
      let part = this.groupByParts[i];
      if (i > 0) {
        groupBySection += ', ';
      }
      if (part.def.type === 'time') {
        groupBySection += '1';
      } else {
        groupBySection += part.render('');
      }
    }

    if (groupBySection.length) {
      query = ' GROUP BY ' + groupBySection;
      if (this.target.metricColumn !== 'None') {
        query += ',2';
      }
    }
    return query;
  }

  buildQuery(target) {
    let query = 'SELECT ';

    query += this.buildTimeColumn(target);
    query += this.buildMetricColumn(target);
    query += this.buildValueColumns(target);

    query += ' FROM ' + target.schema + '.' + target.table;

    query += this.buildWhereClause(target);
    query += this.buildGroupByClause(target);

    query += ' ORDER BY 1';

    return query;
  }
}
