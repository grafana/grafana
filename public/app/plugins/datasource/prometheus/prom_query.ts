import {
  QueryPartDef,
  QueryPart,
  functionRenderer,
  identityRenderer,
  quotedIdentityRenderer,
} from 'app/core/components/query_part/query_part';

import _ from 'lodash';

var index = [];
var categories = {
  Functions: [],
  GroupBy: [],
};

export class PromQuery {
  target: any;
  metric: string;
  range: string;
  filters: any[];
  functions: any[];
  templateSrv: any;
  scopedVars: any;

  constructor(target, templateSrv?, scopedVars?) {
    this.target = target;

    this.target.expr = this.target.expr || '';
    this.target.intervalFactor = this.target.intervalFactor || 2;
    this.target.functions = this.target.functions || [];
    this.target.editorMode = this.target.editorMode || true;

    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;

    this.updateProjection();
  }

  updateProjection() {
    this.functions = _.map(this.target.functions, function(func: any) {
      return createPart(func);
    });
  }

  render() {
    var query = this.target.metric;
    if (this.target.range) {
      query += '[' + this.target.range + ']';
    }

    for (let func of this.functions) {
      query = func.render(query);
    }

    return query;
  }

  addQueryPart(category, item) {
    var partModel = createPart({type: item.text});
    partModel.def.addStrategy(this, partModel);
  }
}

export function createPart(part): any {
  var def = index[part.type];
  if (!def) {
    throw {message: 'Could not find query part ' + part.type};
  }

  return new QueryPart(part, def);
}

function register(options: any) {
  index[options.type] = new QueryPartDef(options);
  options.category.push(index[options.type]);
}

function addFunctionStrategy(model, partModel) {
  model.functions.push(partModel);
  model.target.functions.push(partModel.part);
}

function groupByLabelRenderer(part, innerExpr) {
  return innerExpr + ' by(' + part.params.join(',')  + ')';
}

register({
  type: 'rate',
  addStrategy: addFunctionStrategy,
  category: categories.Functions,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'sum',
  addStrategy: addFunctionStrategy,
  category: categories.Functions,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

register({
  type: 'by',
  addStrategy: addFunctionStrategy,
  category: categories.Functions,
  params: [
    {name: "label", type: "string", dynamicLookup: true}
  ],
  defaultParams: [],
  renderer: groupByLabelRenderer,
});

export function getQueryPartCategories() {
  return categories;
}
