import { QueryPartDef, QueryPart } from 'app/angular/components/query_part';
import { PromVisualQuery } from './types';

export class VisualQueryEngine {
  operations: Record<string, QueryPartDef> = {};

  constructor() {
    this.addOperationDef(
      new QueryPartDef({
        type: 'sum',
        params: [],
        defaultParams: [],
        renderer: functionRenderer,
      })
    );
  }

  private addOperationDef(op: QueryPartDef) {
    this.operations[op.type] = op;
  }

  renderQuery(query: PromVisualQuery) {
    const queryString = `${query.metric}${renderLabels(query)}`;

    for (const operation of query.operations) {
      const def = this.operations[operation.type];
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

export function functionRenderer(part: QueryPart, innerExpr: string) {
  const str = part.def.type + '(';
  const parameters = part.params.map((value, index) => {
    const paramType = part.def.params[index];

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
