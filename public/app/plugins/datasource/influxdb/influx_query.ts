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
    target.groupBy = target.groupBy || [{type: 'time', interval: 'auto'}];
    target.select = target.select || [[
      {name: 'field', params: ['value']},
      {name: 'mean', params: []},
    ]];

    this.updateSelectParts();
    this.groupByParts = [
      queryPart.create({name: 'time', params: ['$interval']})
    ];
  }

  updateSelectParts() {
    this.selectModels = _.map(this.target.select, function(parts: any) {
      return _.map(parts, queryPart.create);
    });
  }

  updatePersistedParts() {
    this.target.select = _.map(this.selectModels, function(selectParts) {
      return _.map(selectParts, function(part: any) {
        return {name: part.def.name, params: part.params};
      });
    });
  }

  removeSelect(index: number) {
    this.target.select.splice(index, 1);
    this.updateSelectParts();
  }

  removeSelectPart(selectParts, part) {
    var partIndex = _.indexOf(selectParts, part);
    selectParts.splice(partIndex, 1);
    this.updatePersistedParts();
  }

  addSelectPart(selectParts, name) {
    var partModel = queryPart.create({name: name});
    partModel.def.addStrategy(selectParts, partModel);
    this.updatePersistedParts();
  }

  addSelect() {
    this.target.select.push([
      {name: 'mean', params: ['value']},
    ]);
    this.updateSelectParts();
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

    if (!target.measurement) {
      throw "Metric measurement is missing";
    }

    if (!target.fields) {
      target.fields = [{name: 'value', func: target.function || 'mean'}];
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

    query += ' GROUP BY';
    for (i = 0; i < target.groupBy.length; i++) {
      var group = target.groupBy[i];
      if (group.type === 'time') {
        query += ' time(' + this.getGroupByTimeInterval(group.interval) + ')';
      } else {
        query += ', "' + group.key + '"';
      }
    }

    if (target.fill) {
      query += ' fill(' + target.fill + ')';
    }

    target.query = query;

    return query;
  }
}

export = InfluxQuery;
