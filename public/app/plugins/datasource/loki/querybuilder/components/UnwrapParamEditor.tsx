import React, { useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

import { getOperationParamId } from '../../../prometheus/querybuilder/shared/operationUtils';
import { QueryBuilderOperationParamEditorProps } from '../../../prometheus/querybuilder/shared/types';
import { LokiDatasource } from '../../datasource';
import { getLogQueryFromMetricsQuery, isValidQuery } from '../../queryUtils';
import { extractUnwrapLabelKeysFromDataFrame } from '../../responseUtils';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { LokiVisualQuery } from '../types';

export function UnwrapParamEditor({
  onChange,
  index,
  operationIndex,
  value,
  query,
  datasource,
}: QueryBuilderOperationParamEditorProps) {
  const [state, setState] = useState<{
    options?: Array<SelectableValue<string>>;
    isLoading?: boolean;
  }>({});

  return (
    <Select
      inputId={getOperationParamId(operationIndex, index)}
      onOpenMenu={async () => {
        // This check is always true, we do it to make typescript happy
        if (datasource instanceof LokiDatasource) {
          setState({ isLoading: true });
          const options = await loadUnwrapOptions(query, datasource);
          setState({ options, isLoading: undefined });
        }
      }}
      isLoading={state.isLoading}
      allowCustomValue
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      options={state.options}
      value={value ? toOption(value.toString()) : null}
      onChange={(value) => {
        if (value.value) {
          onChange(index, value.value);
        }
      }}
    />
  );
}

async function loadUnwrapOptions(
  query: LokiVisualQuery,
  datasource: LokiDatasource
): Promise<Array<SelectableValue<string>>> {
  const queryExpr = lokiQueryModeller.renderQuery(query);
  const logExpr = getLogQueryFromMetricsQuery(queryExpr);
  if (!isValidQuery(logExpr)) {
    return [];
  }

  const samples = await datasource.getDataSamples({ expr: logExpr, refId: 'unwrap_samples' });
  const unwrapLabels = extractUnwrapLabelKeysFromDataFrame(samples[0]);

  const labelOptions = unwrapLabels.map((label) => ({
    label,
    value: label,
  }));

  return labelOptions;
}
