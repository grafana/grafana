import { useState } from 'react';

import { SelectableValue, getDefaultTimeRange, toOption } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps, VisualQueryModeller } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import { placeHolderScopedVars } from '../../components/monaco-query-field/monaco-completion-provider/validation';
import { LokiDatasource } from '../../datasource';
import { getLogQueryFromMetricsQuery, isQueryWithError } from '../../queryUtils';
import { extractUnwrapLabelKeysFromDataFrame } from '../../responseUtils';
import { getOperationParamId } from '../operationUtils';
import { LokiVisualQuery } from '../types';

export function UnwrapParamEditor({
  onChange,
  index,
  operationId,
  value,
  query,
  datasource,
  timeRange,
  queryModeller,
}: QueryBuilderOperationParamEditorProps) {
  const [state, setState] = useState<{
    options?: Array<SelectableValue<string>>;
    isLoading?: boolean;
  }>({});

  return (
    <Select
      inputId={getOperationParamId(operationId, index)}
      onOpenMenu={async () => {
        // This check is always true, we do it to make typescript happy
        if (datasource instanceof LokiDatasource) {
          setState({ isLoading: true });
          const options = await loadUnwrapOptions(query, datasource, queryModeller, timeRange);
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
  datasource: LokiDatasource,
  queryModeller: VisualQueryModeller,
  timeRange = getDefaultTimeRange()
): Promise<Array<SelectableValue<string>>> {
  const queryExpr = queryModeller.renderQuery(query);
  const logExpr = getLogQueryFromMetricsQuery(queryExpr);
  if (isQueryWithError(datasource.interpolateString(logExpr, placeHolderScopedVars))) {
    return [];
  }

  const samples = await datasource.getDataSamples({ expr: logExpr, refId: 'unwrap_samples' }, timeRange);
  const unwrapLabels = extractUnwrapLabelKeysFromDataFrame(samples[0]);

  const labelOptions = unwrapLabels.map((label) => ({
    label,
    value: label,
  }));

  return labelOptions;
}
