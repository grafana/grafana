import { capitalize } from 'lodash';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  QueryWithOperations,
} from './types';

export function functionRendererLeft(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.push(innerExpr);
  }

  return str + params.join(', ') + ')';
}

export function functionRendererRight(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.unshift(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function rangeRendererWithParams(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string,
  renderLeft: boolean
) {
  if (def.params.length < 2) {
    throw `Cannot render a function with params of length [${def.params.length}]`;
  }

  let rangeVector = (model.params ?? [])[0] ?? '5m';

  // Next frame the remaining parameters, but get rid of the first one because it's used to move the
  // instant vector into a range vector.
  const params = renderParams(
    {
      ...model,
      params: model.params.slice(1),
    },
    {
      ...def,
      params: def.params.slice(1),
      defaultParams: def.defaultParams.slice(1),
    },
    innerExpr
  );

  const str = model.id + '(';

  // Depending on the renderLeft variable, render parameters to the left or right
  // renderLeft === true (renderLeft) => (param1, param2, rangeVector[...])
  // renderLeft === false (renderRight) => (rangeVector[...], param1, param2)
  if (innerExpr) {
    renderLeft ? params.push(`${innerExpr}[${rangeVector}]`) : params.unshift(`${innerExpr}[${rangeVector}]`);
  }

  // stick everything together
  return str + params.join(', ') + ')';
}

export function rangeRendererRightWithParams(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  return rangeRendererWithParams(model, def, innerExpr, false);
}

export function rangeRendererLeftWithParams(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  return rangeRendererWithParams(model, def, innerExpr, true);
}

function renderParams(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  return (model.params ?? []).map((value, index) => {
    const paramDef = def.params[index];
    if (paramDef.type === 'string') {
      return '"' + value + '"';
    }

    return value;
  });
}

export function defaultAddOperationHandler<T extends QueryWithOperations>(def: QueryBuilderOperationDef, query: T) {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  return {
    ...query,
    operations: [...query.operations, newOperation],
  };
}

export function getPromAndLokiOperationDisplayName(funcName: string) {
  return capitalize(funcName.replace(/_/g, ' '));
}

export function getOperationParamId(operationIndex: number, paramIndex: number) {
  return `operations.${operationIndex}.param.${paramIndex}`;
}

export function getRangeVectorParamDef(withRateInterval = false): QueryBuilderOperationParamDef {
  const param = {
    name: 'Range',
    type: 'string',
    options: [
      {
        label: '$__interval',
        value: '$__interval',
        // tooltip: 'Dynamic interval based on max data points, scrape and min interval',
      },
      { label: '1m', value: '1m' },
      { label: '5m', value: '5m' },
      { label: '10m', value: '10m' },
      { label: '1h', value: '1h' },
      { label: '24h', value: '24h' },
    ],
  };

  if (withRateInterval) {
    param.options.unshift({
      label: '$__rate_interval',
      value: '$__rate_interval',
      // tooltip: 'Always above 4x scrape interval',
    });
  }

  return param;
}
