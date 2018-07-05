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

    // give interpolateQueryStr access to this
    this.interpolateQueryStr = this.interpolateQueryStr.bind(this);

    this.updateProjection();
  }

  quoteIdentifier(value) {
    return '"' + value.replace('"', '""') + '"';
  }

  quoteLiteral(value) {
    return "'" + value.replace("'", "''") + "'";
  }

  updateProjection() {
    this.selectModels = _.map(this.target.select, function(parts: any) {
      return _.map(parts, sqlPart.create);
    });
    this.whereParts = _.map(this.target.where, sqlPart.create);
    this.groupByParts = _.map(this.target.groupBy, sqlPart.create);
  }

  updatePersistedParts() {
    this.target.select = _.map(this.selectModels, function(selectParts) {
      return _.map(selectParts, function(part: any) {
        return { type: part.def.type, params: part.params };
      });
    });
    this.target.where = _.map(this.whereParts, function(part: any) {
      return { type: part.def.type, params: part.params };
    });
    this.target.groupBy = _.map(this.groupByParts, function(part: any) {
      return { type: part.def.type, params: part.params };
    });
  }

  hasGroupByTime() {
    return _.find(this.target.groupBy, (g: any) => g.type === 'time');
  }

  addGroupBy(partType, value) {
    var partModel = sqlPart.create({ type: partType, params: [value] });
    var partCount = this.target.groupBy.length;

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

  removeSelect(index: number) {
    this.target.select.splice(index, 1);
    this.updateProjection();
  }

  removeSelectPart(selectParts, part) {
    // if we remove the field remove the whole statement
    if (part.def.type === 'column') {
      if (this.selectModels.length > 1) {
        var modelsIndex = _.indexOf(this.selectModels, selectParts);
        this.selectModels.splice(modelsIndex, 1);
      }
    } else {
      var partIndex = _.indexOf(selectParts, part);
      selectParts.splice(partIndex, 1);
    }

    this.updatePersistedParts();
  }

  addSelectPart(selectParts, type) {
    var partModel = sqlPart.create({ type: type });
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

    var escapedValues = _.map(value, this.quoteLiteral);
    return '(' + escapedValues.join(',') + ')';
  }

  render(interpolate?) {
    var target = this.target;

    if (target.rawQuery) {
      if (interpolate) {
        return this.templateSrv.replace(target.rawSql, this.scopedVars, this.interpolateQueryStr);
      } else {
        return target.rawSql;
      }
    }

    var query = 'SELECT ';

    var timeGroup = this.hasGroupByTime();

    if (timeGroup) {
      var args;
      if (timeGroup.params.length > 1 && timeGroup.params[1] !== 'none') {
        args = timeGroup.params.join(',');
      } else {
        args = timeGroup.params[0];
      }
      query += '$__timeGroup(' + this.quoteIdentifier(target.timeColumn) + ',' + args + ')';
    } else {
      query += this.quoteIdentifier(target.timeColumn) + ' AS time';
    }

    if (this.target.metricColumn !== 'None') {
      query += ',' + this.quoteIdentifier(this.target.metricColumn) + ' AS metric';
    }

    var i, y;
    for (i = 0; i < this.selectModels.length; i++) {
      let parts = this.selectModels[i];
      var selectText = '';
      for (y = 0; y < parts.length; y++) {
        let part = parts[y];
        selectText = part.render(selectText);
      }

      query += ', ' + selectText;
    }

    query += ' FROM ' + this.quoteIdentifier(target.schema) + '.' + this.quoteIdentifier(target.table) + ' WHERE ';
    var conditions = _.map(target.where, (tag, index) => {
      return tag.params.join(' ');
    });

    if (conditions.length > 0) {
      query += '(' + conditions.join(' AND ') + ') AND ';
    }

    query += '$__timeFilter(' + this.quoteIdentifier(target.timeColumn) + ')';

    var groupBySection = '';
    for (i = 0; i < this.groupByParts.length; i++) {
      var part = this.groupByParts[i];
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
      query += ' GROUP BY ' + groupBySection;
      if (this.target.metricColumn !== 'None') {
        query += ',2';
      }
    }

    query += ' ORDER BY 1';

    this.target.rawSql = query;
    if (interpolate) {
      query = this.templateSrv.replace(query, this.scopedVars, this.interpolateQueryStr);
    }
    return query;
  }
}
