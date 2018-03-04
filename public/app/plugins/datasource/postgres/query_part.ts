import _ from 'lodash';
import { QueryPartDef, QueryPart, functionRenderer, suffixRenderer } from 'app/core/components/query_part/query_part';

var index = [];
var categories = {
  Aggregations: [],
  Math: [],
  Aliasing: [],
  Columns: [],
};

function createPart(part): any {
  var def = index[part.type];
  if (!def) {
    throw { message: 'Could not find query part ' + part.type };
  }

  return new QueryPart(part, def);
}

function register(options: any) {
  index[options.type] = new QueryPartDef(options);
  options.category.push(index[options.type]);
}

var groupByTimeFunctions = [];

function aliasRenderer(part, innerExpr) {
  return innerExpr + ' AS ' + '"' + part.params[0] + '"';
}

function columnRenderer(part, innerExpr) {
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

function addMathStrategy(selectParts, partModel) {
  var partCount = selectParts.length;
  if (partCount > 0) {
    // if last is math, replace it
    if (selectParts[partCount - 1].def.type === 'math') {
      selectParts[partCount - 1] = partModel;
      return;
    }
    // if next to last is math, replace it
    if (partCount > 1 && selectParts[partCount - 2].def.type === 'math') {
      selectParts[partCount - 2] = partModel;
      return;
    } else if (selectParts[partCount - 1].def.type === 'alias') {
      // if last is alias add it before
      selectParts.splice(partCount - 1, 0, partModel);
      return;
    }
  }
  selectParts.push(partModel);
}

function addAliasStrategy(selectParts, partModel) {
  var partCount = selectParts.length;
  if (partCount > 0) {
    // if last is alias, replace it
    if (selectParts[partCount - 1].def.type === 'alias') {
      selectParts[partCount - 1] = partModel;
      return;
    }
  }
  selectParts.push(partModel);
}

function addColumnStrategy(selectParts, partModel, query) {
  // copy all parts
  var parts = _.map(selectParts, function(part: any) {
    return createPart({ type: part.def.type, params: _.clone(part.params) });
  });

  query.selectModels.push(parts);
}

register({
  type: 'column',
  addStrategy: addColumnStrategy,
  category: categories.Columns,
  params: [{ type: 'column', dynamicLookup: true }],
  defaultParams: ['value'],
  renderer: columnRenderer,
});

// Aggregations
register({
  type: 'avg',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'count',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'sum',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'stddev',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'min',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'max',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'math',
  addStrategy: addMathStrategy,
  category: categories.Math,
  params: [{ name: 'expr', type: 'string' }],
  defaultParams: [' / 100'],
  renderer: suffixRenderer,
});

register({
  type: 'alias',
  addStrategy: addAliasStrategy,
  category: categories.Aliasing,
  params: [{ name: 'name', type: 'string', quote: 'double' }],
  defaultParams: ['alias'],
  renderMode: 'suffix',
  renderer: aliasRenderer,
});

register({
  type: 'time',
  category: groupByTimeFunctions,
  params: [
    {
      name: 'interval',
      type: 'interval',
      options: ['$__interval', '1s', '10s', '1m', '5m', '10m', '15m', '1h'],
    },
    {
      name: 'fill',
      type: 'string',
      options: ['none', 'NULL', '0'],
    },
  ],
  defaultParams: ['$__interval','none'],
  renderer: functionRenderer,
});

export default {
  create: createPart,
  getCategories: function() {
    return categories;
  },
};
