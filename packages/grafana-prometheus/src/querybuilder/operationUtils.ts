// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/operationUtils.ts
import { capitalize } from 'lodash';
import pluralize from 'pluralize';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import {
  QueryBuilderLabelFilter,
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  QueryBuilderOperationParamValue,
  QueryWithOperations,
} from './shared/types';
import { PromVisualQueryOperationCategory } from './types';

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
    if (paramDef?.type === 'string') {
      return `"${value}"`;
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

export function getPromOperationDisplayName(funcName: string) {
  return capitalize(funcName.replace(/_/g, ' '));
}

export function getRangeVectorParamDef(withRateInterval = false): QueryBuilderOperationParamDef {
  const options: Array<SelectableValue<string>> = [
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
  ];

  if (withRateInterval) {
    options.unshift({
      label: '$__rate_interval',
      value: '$__rate_interval',
      // tooltip: 'Always above 4x scrape interval',
    });
  }

  const param: QueryBuilderOperationParamDef = {
    name: 'Range',
    type: 'string',
    options,
  };

  return param;
}

export function createAggregationOperation(
  name: string,
  overrides: Partial<QueryBuilderOperationDef> = {}
): QueryBuilderOperationDef[] {
  const operations: QueryBuilderOperationDef[] = [
    {
      id: name,
      name: getPromOperationDisplayName(name),
      params: [
        {
          name: 'By label',
          type: 'string',
          restParam: true,
          optional: true,
        },
      ],
      defaultParams: [],
      alternativesKey: 'plain aggregations',
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      paramChangedHandler: getOnLabelAddedHandler(`__${name}_by`),
      explainHandler: getAggregationExplainer(name, ''),
      addOperationHandler: defaultAddOperationHandler,
      ...overrides,
    },
    {
      id: `__${name}_by`,
      name: `${getPromOperationDisplayName(name)} by`,
      params: [
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: 'LabelParamEditor',
        },
      ],
      defaultParams: [''],
      alternativesKey: 'aggregations by',
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: getAggregationByRenderer(name),
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'by'),
      addOperationHandler: defaultAddOperationHandler,
      hideFromList: true,
      ...overrides,
    },
    {
      id: `__${name}_without`,
      name: `${getPromOperationDisplayName(name)} without`,
      params: [
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: 'LabelParamEditor',
        },
      ],
      defaultParams: [''],
      alternativesKey: 'aggregations by',
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: getAggregationWithoutRenderer(name),
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'without'),
      addOperationHandler: defaultAddOperationHandler,
      hideFromList: true,
      ...overrides,
    },
  ];

  return operations;
}

export function createAggregationOperationWithParam(
  name: string,
  paramsDef: { params: QueryBuilderOperationParamDef[]; defaultParams: QueryBuilderOperationParamValue[] },
  overrides: Partial<QueryBuilderOperationDef> = {}
): QueryBuilderOperationDef[] {
  const operations = createAggregationOperation(name, overrides);
  operations[0].params.unshift(...paramsDef.params);
  operations[1].params.unshift(...paramsDef.params);
  operations[2].params.unshift(...paramsDef.params);
  operations[0].defaultParams = paramsDef.defaultParams;
  operations[1].defaultParams = [...paramsDef.defaultParams, ''];
  operations[2].defaultParams = [...paramsDef.defaultParams, ''];
  operations[1].renderer = getAggregationByRendererWithParameter(name);
  operations[2].renderer = getAggregationByRendererWithParameter(name);
  return operations;
}

export function getAggregationByRenderer(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${aggregation} by(${model.params.join(', ')}) (${innerExpr})`;
  };
}

function getAggregationWithoutRenderer(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${aggregation} without(${model.params.join(', ')}) (${innerExpr})`;
  };
}

/**
 * Very simple poc implementation, needs to be modified to support all aggregation operators
 */
export function getAggregationExplainer(aggregationName: string, mode: 'by' | 'without' | '') {
  return function aggregationExplainer(model: QueryBuilderOperation) {
    const labels = model.params.map((label) => `\`${label}\``).join(' and ');
    const labelWord = pluralize('label', model.params.length);

    switch (mode) {
      case 'by':
        return t(
          'grafana-prometheus.querybuilder.operation-utils.getAggregationExplainer.label-by',
          'Calculates {{aggregationName}} over dimensions while preserving {{labelWord}} {{labels}}.',
          { aggregationName, labelWord, labels }
        );
      case 'without':
        return t(
          'grafana-prometheus.querybuilder.operation-utils.getAggregationExplainer.label-without',
          'Calculates {{aggregationName}} over the dimensions {{labels}}. All other labels are preserved.',
          { aggregationName, labels }
        );
      default:
        return t(
          'grafana-prometheus.querybuilder.operation-utils.getAggregationExplainer.label-default',
          'Calculates {{aggregationName}} over the dimensions.',
          { aggregationName }
        );
    }
  };
}

function getAggregationByRendererWithParameter(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    const restParamIndex = def.params.findIndex((param) => param.restParam);
    const params = model.params.slice(0, restParamIndex);
    const restParams = model.params.slice(restParamIndex);

    return `${aggregation} by(${restParams.join(', ')}) (${params
      .map((param, idx) => (def.params[idx].type === 'string' ? `\"${param}\"` : param))
      .join(', ')}, ${innerExpr})`;
  };
}

/**
 * This function will transform operations without labels to their plan aggregation operation
 */
export function getLastLabelRemovedHandler(changeToOperationId: string) {
  return function onParamChanged(index: number, op: QueryBuilderOperation, def: QueryBuilderOperationDef) {
    // If definition has more params then is defined there are no optional rest params anymore.
    // We then transform this operation into a different one
    if (op.params.length < def.params.length) {
      return {
        ...op,
        id: changeToOperationId,
      };
    }

    return op;
  };
}

export function getOnLabelAddedHandler(changeToOperationId: string) {
  return function onParamChanged(index: number, op: QueryBuilderOperation, def: QueryBuilderOperationDef) {
    // Check if we actually have the label param. As it's optional the aggregation can have one less, which is the
    // case of just simple aggregation without label. When user adds the label it now has the same number of params
    // as its definition, and now we can change it to its `_by` variant.
    if (op.params.length === def.params.length) {
      return {
        ...op,
        id: changeToOperationId,
      };
    }
    return op;
  };
}

export function isConflictingSelector(
  newLabel: Partial<QueryBuilderLabelFilter>,
  labels: Array<Partial<QueryBuilderLabelFilter>>
): boolean {
  if (!newLabel.label || !newLabel.op || !newLabel.value) {
    return false;
  }

  if (labels.length < 2) {
    return false;
  }

  const operationIsNegative = newLabel.op.toString().startsWith('!');

  const candidates = labels.filter(
    (label) => label.label === newLabel.label && label.value === newLabel.value && label.op !== newLabel.op
  );

  const conflict = candidates.some((candidate) => {
    if (operationIsNegative && candidate?.op?.toString().startsWith('!') === false) {
      return true;
    }
    if (operationIsNegative === false && candidate?.op?.toString().startsWith('!')) {
      return true;
    }
    return false;
  });

  return conflict;
}
