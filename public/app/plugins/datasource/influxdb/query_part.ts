///<reference path="../../../headers/common.d.ts" />

import _ = require('lodash');

var index = [];
var categories = {
  Aggregations: [],
  Transformations: [],
  Math: [],
  Aliasing: [],
  Fields: [],
};

var groupByTimeFunctions = [];

class QueryPartDef {
  type: string;
  params: any[];
  defaultParams: any[];
  renderer: any;
  category: any;
  addStrategy: any;

  constructor(options: any) {
    this.type = options.type;
    this.params = options.params;
    this.defaultParams = options.defaultParams;
    this.renderer = options.renderer;
    this.category = options.category;
    this.addStrategy = options.addStrategy;
  }

  static register(options: any) {
    index[options.type] = new QueryPartDef(options);
    options.category.push(index[options.type]);
  }
}

function functionRenderer(part, innerExpr) {
  var str = part.def.type + '(';
  var parameters = _.map(part.params, (value, index) => {
    var paramType = part.def.params[index];
    if (paramType.quote === 'single') {
      return "'" + value + "'";
    } else if (paramType.quote === 'double') {
      return '"' + value + '"';
    }

    return value;
  });

  if (innerExpr) {
    parameters.unshift(innerExpr);
  }
  return str + parameters.join(', ') + ')';
}

function aliasRenderer(part, innerExpr) {
  return innerExpr + ' AS ' + '"' + part.params[0] + '"';
}

function suffixRenderer(part, innerExpr) {
  return innerExpr + ' ' + part.params[0];
}

function identityRenderer(part, innerExpr) {
  return part.params[0];
}

function quotedIdentityRenderer(part, innerExpr) {
  return '"' + part.params[0] + '"';
}

function replaceAggregationAddStrategy(selectParts, partModel) {
  // look for existing aggregation
  for (var i = 0; i < selectParts.length; i++) {
    var part = selectParts[i];
    if (part.def.category === categories.Aggregations) {
      selectParts[i] = partModel;
      return;
    }
  }

  selectParts.splice(1, 0, partModel);
}

function addTransformationStrategy(selectParts, partModel) {
  var i;
  // look for index to add transformation
  for (i = 0; i < selectParts.length; i++) {
    var part = selectParts[i];
    if (part.def.category === categories.Math  || part.def.category === categories.Aliasing) {
      break;
    }
  }

  selectParts.splice(i, 0, partModel);
}

function addMathStrategy(selectParts, partModel) {
  var partCount = selectParts.length;
  if (partCount > 0) {
    // if last is math, replace it
    if (selectParts[partCount-1].def.type === 'math') {
      selectParts[partCount-1] = partModel;
      return;
    }
    // if next to last is math, replace it
    if (selectParts[partCount-2].def.type === 'math') {
      selectParts[partCount-2] = partModel;
      return;
    }
    // if last is alias add it before
    else if (selectParts[partCount-1].def.type === 'alias') {
      selectParts.splice(partCount-1, 0, partModel);
      return;
    }
  }
  selectParts.push(partModel);
}

function addAliasStrategy(selectParts, partModel) {
  var partCount = selectParts.length;
  if (partCount > 0) {
    // if last is alias, replace it
    if (selectParts[partCount-1].def.type === 'alias') {
      selectParts[partCount-1] = partModel;
      return;
    }
  }
  selectParts.push(partModel);
}

function addFieldStrategy(selectParts, partModel, query) {
  // copy all parts
  var parts = _.map(selectParts, function(part: any) {
    return new QueryPart({type: part.def.type, params: _.clone(part.params)});
  });

  query.selectModels.push(parts);
}

QueryPartDef.register({
  type: 'field',
  addStrategy: addFieldStrategy,
  category: categories.Fields,
  params: [{type: 'field'}],
  defaultParams: ['value'],
  renderer: quotedIdentityRenderer,
});

QueryPartDef.register({
  type: 'mean',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

QueryPartDef.register({
  type: 'sum',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

QueryPartDef.register({
  type: 'derivative',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [{ name: "duration", type: "interval", options: ['1s', '10s', '1m', '5min', '10m', '15m', '1h']}],
  defaultParams: ['10s'],
  renderer: functionRenderer,
});

QueryPartDef.register({
  type: 'time',
  category: groupByTimeFunctions,
  params: [{ name: "rate", type: "interval", options: ['$interval', '1s', '10s', '1m', '5min', '10m', '15m', '1h'] }],
  defaultParams: ['$interval'],
  renderer: functionRenderer,
});

QueryPartDef.register({
  type: 'tag',
  category: groupByTimeFunctions,
  params: [{name: 'tag', type: 'string'}],
  defaultParams: ['tag'],
  renderer: quotedIdentityRenderer,
});

QueryPartDef.register({
  type: 'math',
  addStrategy: addMathStrategy,
  category: categories.Math,
  params: [{ name: "expr", type: "string"}],
  defaultParams: [' / 100'],
  renderer: suffixRenderer,
});

QueryPartDef.register({
  type: 'alias',
  addStrategy: addAliasStrategy,
  category: categories.Aliasing,
  params: [{ name: "name", type: "string", quote: 'double'}],
  defaultParams: ['alias'],
  renderMode: 'suffix',
  renderer: aliasRenderer,
});

class QueryPart {
  part: any;
  def: QueryPartDef;
  params: any[];
  text: string;

  constructor(part: any) {
    this.part = part;
    this.def = index[part.type];
    if (!this.def) {
      throw {message: 'Could not find query part ' + part.type};
    }

    part.params = part.params || _.clone(this.def.defaultParams);
    this.params = part.params;
    this.updateText();
  }

  render(innerExpr: string) {
    return this.def.renderer(this, innerExpr);
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
      this.text = this.def.type + '()';
      return;
    }

    var text = this.def.type + '(';
    text += this.params.join(', ');
    text += ')';
    this.text = text;
  }
}

export = {
  create: function(part): any {
    return new QueryPart(part);
  },

  getCategories: function() {
    return categories;
  }
};
