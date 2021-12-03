import {
  PromVisualQuery,
  PromVisualQueryOperation,
  PromVisualQueryOperationCategory,
  PromVisualQueryOperationDef,
} from './types';

export class VisualQueryEngine {
  private operations: Record<string, PromVisualQueryOperationDef> = {};

  constructor() {
    this.addOperationDef({
      id: 'sum',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
    });

    this.addOperationDef({
      id: 'avg',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
    });

    this.addOperationDef({
      id: 'histogram_quantile',
      displayName: 'Histogram quantile',
      params: [{ name: 'Quantile', type: 'number', options: [0.99, 0.95, 0.9, 0.75, 0.5, 0.25] }],
      defaultParams: [0.9],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
    });

    this.addOperationDef({
      id: 'label_replace',
      params: [
        { name: 'Destination label', type: 'string' },
        { name: 'Replacement', type: 'string' },
        { name: 'Source label', type: 'string' },
        { name: 'Regex', type: 'string' },
      ],
      category: PromVisualQueryOperationCategory.Functions,
      defaultParams: [],
      renderer: functionRendererRight,
    });

    this.addOperationDef({
      // Because this is not a real function I prefix it with __ so it wont conflict if Prometheus ever adds a function named group_by
      id: '__group_by',
      displayName: 'Group by',
      params: [
        { name: 'Aggregation', type: 'string' },
        { name: 'Label', type: 'string', restParam: true },
      ],
      defaultParams: ['sum'],
      category: PromVisualQueryOperationCategory.GroupBy,
      renderer: groupByRenderer,
    });

    this.addOperationDef({
      id: 'rate',
      displayName: 'Rate',
      params: [{ name: 'Range vector', type: 'string' }],
      defaultParams: ['auto'],
      category: PromVisualQueryOperationCategory.RateAndDeltas,
      renderer: rateRenderer,
    });

    // Not sure about this one. It could also be a more generic "Simple math operation" where user specifies
    // both the operator and the operand in a single input
    this.addOperationDef({
      id: '__multiply_by',
      displayName: 'Multiply by',
      params: [{ name: 'Factor', type: 'number' }],
      defaultParams: [2],
      category: PromVisualQueryOperationCategory.Math,
      renderer: multiplyRenderer,
    });

    this.addOperationDef({
      id: '__divide_by_sub_query',
      displayName: 'Divide by sub query',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Math,
      renderer: multiplyRenderer,
    });
  }

  private addOperationDef(op: PromVisualQueryOperationDef) {
    this.operations[op.id] = op;
  }

  getOperationsForCategory(category: PromVisualQueryOperationCategory) {
    return Object.values(this.operations).filter((op) => op.category === category);
  }

  getOperationDef(id: string) {
    const operation = this.operations[id];
    if (!operation) {
      throw new Error(`Operation ${id} not found`);
    }
    return operation;
  }

  renderQuery(query: PromVisualQuery) {
    let queryString = `${query.metric}${this.renderLabels(query)}`;

    for (const operation of query.operations) {
      const def = this.operations[operation.id];
      if (!def) {
        throw new Error(`Operation ${operation.id} not found`);
      }
      queryString = def.renderer(operation, def, queryString);
    }

    return queryString;
  }

  renderLabels(query: PromVisualQuery) {
    if (query.labels.length === 0) {
      return '';
    }

    let expr = '{';
    for (const filter of query.labels) {
      if (expr !== '{') {
        expr += ', ';
      }

      expr += `${filter.label}${filter.op}"${filter.value}"`;
    }

    return expr + `}`;
  }
}

function functionRendererLeft(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.push(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function functionRendererRight(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.unshift(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function renderParams(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  return (model.params ?? []).map((value, index) => {
    const paramDef = def.params[index];
    if (paramDef.type === 'string') {
      return '"' + value + '"';
    }

    return value;
  });
}

function groupByRenderer(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  if (!model.params || model.params.length < 2) {
    throw Error('Params missing on group by');
  }

  // First param is the aggregation, the rest are labels
  let expr = `${model.params[0]} by(`;

  for (let i = 1; i < model.params.length; i++) {
    if (i > 1) {
      expr += ', ';
    }

    expr += model.params[i];
  }

  return `${expr}) (${innerExpr})`;
}

function rateRenderer(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  let rangeVector = (model.params ?? [])[0] ?? 'auto';

  if (rangeVector === 'auto') {
    rangeVector = '$__rate_interval';
  }

  return `rate(${innerExpr}[${rangeVector}])`;
}

function multiplyRenderer(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  return `(${innerExpr}) * ${model.params[0]}`;
}

export const visualQueryEngine = new VisualQueryEngine();
