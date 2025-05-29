import { capitalize } from 'lodash';

import { SelectableValue } from '@grafana/data';

import {
  functionRendererLeft,
  getOnLabelAddedHandler,
  getAggregationExplainer,
  defaultAddOperationHandler,
  getAggregationByRenderer,
  getLastLabelRemovedHandler,
} from './operationUtils';
import { QueryBuilderOperationDef, QueryBuilderOperationParamDef } from './shared/types';
import { PromVisualQueryOperationCategory } from './types';

export function getRangeVectorParamDef(withRateInterval = false): QueryBuilderOperationParamDef {
  const options: Array<SelectableValue<string>> = [
    {
      label: '$__interval',
      value: '$__interval',
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
  ];

  return operations;
}

function getPromOperationDisplayName(funcName: string) {
  return capitalize(funcName.replace(/_/g, ' '));
}
