///<reference path="../../../headers/common.d.ts" />

import _ = require('lodash');

var index = [];
var categories = {
  Combine: [],
  Transform: [],
  Calculate: [],
  Filter: [],
  Special: []
};

class QueryPartDef {
  name: string;
  params: any[];
  defaultParams: any[];

  constructor(options: any) {
    this.name = options.name;
    this.params = options.params;
    this.defaultParams = options.defaultParams;
  }

  static register(options: any) {
    index[options.name] = new QueryPartDef(options);
  }
}

QueryPartDef.register({
  name: 'field',
  category: categories.Transform,
  params: [{type: 'field'}],
  defaultParams: ['value'],
});

QueryPartDef.register({
  name: 'mean',
  category: categories.Transform,
  params: [],
  defaultParams: [],
});

QueryPartDef.register({
  name: 'derivate',
  category: categories.Transform,
  params: [{ name: "rate", type: "interval", options: ['1s', '10s', '1m', '5min', '10m', '15m', '1h'] }],
  defaultParams: ['10s'],
});

QueryPartDef.register({
  name: 'time',
  category: categories.Transform,
  params: [{ name: "rate", type: "interval", options: ['$interval', '1s', '10s', '1m', '5min', '10m', '15m', '1h'] }],
  defaultParams: ['$interval'],
});

QueryPartDef.register({
  name: 'math',
  category: categories.Transform,
  params: [{ name: "expr", type: "string"}],
  defaultParams: [' / 100'],
});

QueryPartDef.register({
  name: 'alias',
  category: categories.Transform,
  params: [{ name: "name", type: "string"}],
  defaultParams: ['alias'],
});

class QueryPart {
  part: any;
  def: QueryPartDef;
  params: any[];
  text: string;

  constructor(part: any) {
    this.part = part;
    this.def = index[part.name];
    if (!this.def) {
      throw {message: 'Could not find query part ' + part.name};
    }

    this.params = part.params || _.clone(this.def.defaultParams);
  }

  render(innerExpr: string) {
    var str = this.def.name + '(';
    var parameters = _.map(this.params, (value, index) => {

      var paramType = this.def.params[index].type;
      if (paramType === 'int' || paramType === 'value_or_series' || paramType === 'boolean') {
        return value;
      }
      else if (paramType === 'int_or_interval' && _.isNumber(value)) {
        return value;
      }

      return "'" + value + "'";

    });

    if (innerExpr) {
      parameters.unshift(innerExpr);
    }

    return str + parameters.join(', ') + ')';
  }

  hasMultipleParamsInString (strValue, index) {
    if (strValue.indexOf(',') === -1) {
      return false;
    }

    return this.def.params[index + 1] && this.def.params[index + 1].optional;
  }

  updateParam (strValue, index) {
    // handle optional parameters
    // if string contains ',' and next param is optional, split and update both
    if (this.hasMultipleParamsInString(strValue, index)) {
      _.each(strValue.split(','), function(partVal: string, idx) {
        this.updateParam(partVal.trim(), idx);
      }, this);
      return;
    }

    if (strValue === '' && this.def.params[index].optional) {
      this.params.splice(index, 1);
    }
    else {
      this.params[index] = strValue;
    }

    this.part.params = this.params;
    this.updateText();
  }

  updateText() {
    if (this.params.length === 0) {
      this.text = this.def.name + '()';
      return;
    }

    var text = this.def.name + '(';
    text += this.params.join(', ');
    text += ')';
    this.text = text;
  }
}

export = {
  create: function(part): any {
    return new QueryPart(part);
  },

  getFuncDef: function(name) {
    return index[name];
  },

  getCategories: function() {
    return categories;
  }
};
