///<reference path="../../../headers/common.d.ts" />
///<amd-dependency path="./query_builder" name="InfluxQueryBuilder" />

import _ = require('lodash');
import queryPart = require('./query_part');

declare var InfluxQueryBuilder: any;

class InfluxQuery {
  target: any;
  selectModels: any[];
  groupByParts: any;
  queryBuilder: any;

  constructor(target) {
    this.target = target;

    target.tags = target.tags || [];
    target.groupBy = target.groupBy || [{type: 'time', params: ['$interval']}];
    target.select = target.select || [[
      {type: 'field', params: ['value']},
      {type: 'mean', params: []},
    ]];

    this.updateProjection();
  }

  updateProjection() {
    this.selectModels = _.map(this.target.select, function(parts: any) {
      return _.map(parts, queryPart.create);
    });
    this.groupByParts = _.map(this.target.groupBy, queryPart.create);
  }

  updatePersistedParts() {
    this.target.select = _.map(this.selectModels, function(selectParts) {
      return _.map(selectParts, function(part: any) {
        return {type: part.def.type, params: part.params};
      });
    });
  }

  hasGroupByTime() {
    return false;
  }

  hasFill() {
    return false;
  }

  addGroupBy(value) {
    var stringParts = value.match(/^(\w+)\((.*)\)$/);
    var typePart = stringParts[1];
    var arg = stringParts[2];
    console.log(value, stringParts);
    var partModel = queryPart.create({type: typePart, params: [arg]});
    this.target.groupBy.push(partModel.part);
    this.updateProjection();
  }

  removeGroupByPart(part, index) {
    this.target.groupBy.splice(index, 1);
    this.updateProjection();
  }

  removeSelect(index: number) {
    this.target.select.splice(index, 1);
    this.updateProjection();
  }

  removeSelectPart(selectParts, part) {
    // if we remove the field remove the whole statement
    if (part.def.type === 'field') {
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
    var partModel = queryPart.create({type: type});
    partModel.def.addStrategy(selectParts, partModel, this);
    this.updatePersistedParts();
  }

  private renderTagCondition(tag, index) {
    var str = "";
    var operator = tag.operator;
    var value = tag.value;
    if (index > 0) {
      str = (tag.condition || 'AND') + ' ';
    }

    if (!operator) {
      if (/^\/.*\/$/.test(tag.value)) {
        operator = '=~';
      } else {
        operator = '=';
      }
    }

    // quote value unless regex
    if (operator !== '=~' && operator !== '!~') {
      value = "'" + value + "'";
    }

    return str + '"' + tag.key + '" ' + operator + ' ' + value;
  }

  private getGroupByTimeInterval(interval) {
    if (interval === 'auto') {
      return '$interval';
    }
    return interval;
  }

  render() {
    var target = this.target;

    if (target.rawQuery) {
      return target.query;
    }

    if (!target.measurement) {
      throw "Metric measurement is missing";
    }

    var query = 'SELECT ';
    var i, y;
    for (i = 0; i < this.selectModels.length; i++) {
      let parts = this.selectModels[i];
      var selectText = "";
      for (y = 0; y < parts.length; y++) {
        let part = parts[y];
        selectText = part.render(selectText);
      }

      if (i > 0) {
        query += ', ';
      }
      query += selectText;
    }

    var measurement = target.measurement;
    if (!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
      measurement = '"' + measurement+ '"';
    }

    query += ' FROM ' + measurement + ' WHERE ';
    var conditions = _.map(target.tags, (tag, index) => {
      return this.renderTagCondition(tag, index);
    });

    query += conditions.join(' ');
    query += (conditions.length > 0 ? ' AND ' : '') + '$timeFilter';

    query += ' GROUP BY ';
    for (i = 0; i < this.groupByParts.length; i++) {
      var part = this.groupByParts[i];
      if (i > 0) {
        query += ', ';
      }
      query += part.render('');
    }

    if (target.fill) {
      query += ' fill(' + target.fill + ')';
    }

    target.query = query;

    return query;
  }
}

export = InfluxQuery;
