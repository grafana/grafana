import { isNaN } from 'lodash';
import React, { useState } from 'react';

import { isValidGoDuration, SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

import { getOperationParamId } from '../../../prometheus/querybuilder/shared/operationUtils';
import { QueryBuilderOperationParamEditorProps } from '../../../prometheus/querybuilder/shared/types';
import { LokiDatasource } from '../../datasource';
import { isBytesString } from '../../languageUtils';
import { getLogQueryFromMetricsQuery, isValidQuery } from '../../queryUtils';
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
  const labelsArray: Array<{ [key: string]: string }> | undefined =
    samples[0]?.fields?.find((field) => field.name === 'labels')?.values.toArray() ?? [];

  if (!labelsArray || labelsArray.length === 0) {
    return [];
  }

  // We do this only for first label object, because we want to consider only labels that are present in all log lines
  // possibleUnwrapLabels are labels with 1. number value OR 2. value that is valid go duration OR 3. bytes string value
  const possibleUnwrapLabels = Object.keys(labelsArray[0]).filter((key) => {
    const value = labelsArray[0][key];
    if (!value) {
      return false;
    }
    return !isNaN(Number(value)) || isValidGoDuration(value) || isBytesString(value);
  });

  const unwrapLabels: string[] = [];
  for (const label of possibleUnwrapLabels) {
    // Add only labels that are present in every line to unwrapLabels
    if (labelsArray.every((obj) => obj[label])) {
      unwrapLabels.push(label);
    }
  }

  const labelOptions = unwrapLabels.map((label) => ({
    label,
    value: label,
  }));

  return labelOptions;
}
