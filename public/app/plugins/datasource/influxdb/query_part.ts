import _ from 'lodash';
import { QueryPartDef, QueryPart, functionRenderer, suffixRenderer } from 'app/core/components/query_part/query_part';

const index: any[] = [];
const categories: any = {
  Aggregations: [],
  Selectors: [],
  Transformations: [],
  Predictors: [],
  Math: [],
  Aliasing: [],
  Fields: [],
};

function createPart(part: any): any {
  const def = index[part.type];
  if (!def) {
    throw { message: 'Could not find query part ' + part.type };
  }

  return new QueryPart(part, def);
}

function register(options: any) {
  index[options.type] = new QueryPartDef(options);
  options.category.push(index[options.type]);
}

const groupByTimeFunctions: any[] = [];

function aliasRenderer(part: { params: string[] }, innerExpr: string) {
  return innerExpr + ' AS ' + '"' + part.params[0] + '"';
}

function fieldRenderer(part: { params: string[] }, innerExpr: any) {
  if (part.params[0] === '*') {
    return '*';
  }
  return '"' + part.params[0] + '"';
}

function replaceAggregationAddStrategy(selectParts: any[], partModel: { def: { type: string } }) {
  // look for existing aggregation
  for (let i = 0; i < selectParts.length; i++) {
    const part = selectParts[i];
    if (part.def.category === categories.Aggregations) {
      if (part.def.type === partModel.def.type) {
        return;
      }
      // count distinct is allowed
      if (part.def.type === 'count' && partModel.def.type === 'distinct') {
        break;
      }
      // remove next aggregation if distinct was replaced
      if (part.def.type === 'distinct') {
        const morePartsAvailable = selectParts.length >= i + 2;
        if (partModel.def.type !== 'count' && morePartsAvailable) {
          const nextPart = selectParts[i + 1];
          if (nextPart.def.category === categories.Aggregations) {
            selectParts.splice(i + 1, 1);
          }
        } else if (partModel.def.type === 'count') {
          if (!morePartsAvailable || selectParts[i + 1].def.type !== 'count') {
            selectParts.splice(i + 1, 0, partModel);
          }
          return;
        }
      }
      selectParts[i] = partModel;
      return;
    }
    if (part.def.category === categories.Selectors) {
      selectParts[i] = partModel;
      return;
    }
  }

  selectParts.splice(1, 0, partModel);
}

function addTransformationStrategy(selectParts: any[], partModel: any) {
  let i;
  // look for index to add transformation
  for (i = 0; i < selectParts.length; i++) {
    const part = selectParts[i];
    if (part.def.category === categories.Math || part.def.category === categories.Aliasing) {
      break;
    }
  }

  selectParts.splice(i, 0, partModel);
}

function addMathStrategy(selectParts: any[], partModel: any) {
  const partCount = selectParts.length;
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

function addAliasStrategy(selectParts: any[], partModel: any) {
  const partCount = selectParts.length;
  if (partCount > 0) {
    // if last is alias, replace it
    if (selectParts[partCount - 1].def.type === 'alias') {
      selectParts[partCount - 1] = partModel;
      return;
    }
  }
  selectParts.push(partModel);
}

function addFieldStrategy(selectParts: any, partModel: any, query: { selectModels: any[][] }) {
  // copy all parts
  const parts = _.map(selectParts, (part: any) => {
    return createPart({ type: part.def.type, params: _.clone(part.params) });
  });

  query.selectModels.push(parts);
}

register({
  type: 'field',
  addStrategy: addFieldStrategy,
  category: categories.Fields,
  params: [{ type: 'field', dynamicLookup: true }],
  defaultParams: ['value'],
  renderer: fieldRenderer,
});

// Aggregations
register({
  type: 'count',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'distinct',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'integral',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'mean',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'median',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Aggregations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'mode',
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

// transformations

register({
  type: 'derivative',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [
    {
      name: 'duration',
      type: 'interval',
      options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h'],
    },
  ],
  defaultParams: ['10s'],
  renderer: functionRenderer,
});

register({
  type: 'spread',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'non_negative_derivative',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [
    {
      name: 'duration',
      type: 'interval',
      options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h'],
    },
  ],
  defaultParams: ['10s'],
  renderer: functionRenderer,
});

register({
  type: 'difference',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'non_negative_difference',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'moving_average',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [{ name: 'window', type: 'int', options: [5, 10, 20, 30, 40] }],
  defaultParams: [10],
  renderer: functionRenderer,
});

register({
  type: 'cumulative_sum',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'stddev',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'time',
  category: groupByTimeFunctions,
  params: [
    {
      name: 'interval',
      type: 'time',
      options: ['$__interval', '1s', '10s', '1m', '5m', '10m', '15m', '1h'],
    },
  ],
  defaultParams: ['$__interval'],
  renderer: functionRenderer,
});

register({
  type: 'fill',
  category: groupByTimeFunctions,
  params: [
    {
      name: 'fill',
      type: 'string',
      options: ['none', 'null', '0', 'previous', 'linear'],
    },
  ],
  defaultParams: ['null'],
  renderer: functionRenderer,
});

register({
  type: 'elapsed',
  addStrategy: addTransformationStrategy,
  category: categories.Transformations,
  params: [
    {
      name: 'duration',
      type: 'interval',
      options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h'],
    },
  ],
  defaultParams: ['10s'],
  renderer: functionRenderer,
});

// predictions
register({
  type: 'holt_winters',
  addStrategy: addTransformationStrategy,
  category: categories.Predictors,
  params: [
    { name: 'number', type: 'int', options: [5, 10, 20, 30, 40] },
    { name: 'season', type: 'int', options: [0, 1, 2, 5, 10] },
  ],
  defaultParams: [10, 2],
  renderer: functionRenderer,
});

register({
  type: 'holt_winters_with_fit',
  addStrategy: addTransformationStrategy,
  category: categories.Predictors,
  params: [
    { name: 'number', type: 'int', options: [5, 10, 20, 30, 40] },
    { name: 'season', type: 'int', options: [0, 1, 2, 5, 10] },
  ],
  defaultParams: [10, 2],
  renderer: functionRenderer,
});

// Selectors
register({
  type: 'bottom',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Selectors,
  params: [{ name: 'count', type: 'int' }],
  defaultParams: [3],
  renderer: functionRenderer,
});

register({
  type: 'first',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Selectors,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'last',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Selectors,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'max',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Selectors,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'min',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Selectors,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'percentile',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Selectors,
  params: [{ name: 'nth', type: 'int' }],
  defaultParams: [95],
  renderer: functionRenderer,
});

register({
  type: 'top',
  addStrategy: replaceAggregationAddStrategy,
  category: categories.Selectors,
  params: [{ name: 'count', type: 'int' }],
  defaultParams: [3],
  renderer: functionRenderer,
});

register({
  type: 'tag',
  category: groupByTimeFunctions,
  params: [{ name: 'tag', type: 'string', dynamicLookup: true }],
  defaultParams: ['tag'],
  renderer: fieldRenderer,
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

export default {
  create: createPart,
  getCategories: () => {
    return categories;
  },
  replaceAggregationAdd: replaceAggregationAddStrategy,
};
