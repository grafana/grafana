import { PromVisualQuery, PromVisualQueryOperation, PromVisualQueryOperationDef } from './types';

export class VisualQueryEngine {
  operations: Record<string, PromVisualQueryOperationDef> = {};

  constructor() {
    this.addOperationDef({
      type: 'sum',
      params: [],
      defaultParams: [],
      renderer: functionRendererLeft,
    });

    this.addOperationDef({
      type: 'avg',
      params: [],
      defaultParams: [],
      renderer: functionRendererLeft,
    });

    this.addOperationDef({
      type: 'histogram_quantile',
      params: [{ name: 'quantile', type: 'number', options: [0.99, 0.95, 0.9, 0.75, 0.5, 0.25] }],
      defaultParams: [0.9],
      renderer: functionRendererLeft,
    });

    this.addOperationDef({
      type: 'label_replace',
      params: [
        { name: 'dst_label', type: 'string' },
        { name: 'replacement', type: 'string' },
        { name: 'src_label', type: 'string' },
        { name: 'regex', type: 'string' },
      ],
      defaultParams: [],
      renderer: functionRendererRight,
    });

    this.addOperationDef({
      type: 'group by',
      params: [
        { name: 'aggregation', type: 'string' },
        { name: 'label', type: 'string', multiple: true },
      ],
      defaultParams: ['sum'],
      renderer: groupByRenderer,
    });

    this.addOperationDef({
      type: 'rate',
      params: [{ name: 'range-vector', type: 'string' }],
      defaultParams: ['auto'],
      renderer: rateRenderer,
    });
  }

  private addOperationDef(op: PromVisualQueryOperationDef) {
    this.operations[op.type] = op;
  }

  renderQuery(query: PromVisualQuery) {
    let queryString = `${query.metric}${this.renderLabels(query)}`;

    for (const operation of query.operations) {
      const def = this.operations[operation.type];
      if (!def) {
        throw new Error(`Operation ${operation.type} not found`);
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
  const str = model.type + '(';

  if (innerExpr) {
    params.push(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function functionRendererRight(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.type + '(';

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
