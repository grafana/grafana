import {
  QueryPartDef,
  QueryPart,
  functionRenderer,
  suffixRenderer,
  identityRenderer,
  quotedIdentityRenderer,
} from 'app/core/components/query_part/query_part';

var index = [];
var categories = {
  Functions: [],
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
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;
  }

  render() {
    var query = this.target.metric;
    if (this.target.range) {
      query += '[' + this.target.range + ']';
    }

    for (let funcModel of this.target.functions) {
      var partDef = index[funcModel.type];
      if (!partDef) {
        continue;
      }

      var part = new QueryPart(funcModel, partDef);
      query = part.render(query);
    }

    return query;
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
}

register({
  type: 'rate',
  addStrategy: addFunctionStrategy,
  category: categories.Functions,
  params: [],
  defaultParams: [],
  renderer: functionRenderer,
});

export function getCategories() {
  return categories;
}
