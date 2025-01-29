import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/plugin-ui';
import { MultiSelect } from '@grafana/ui';

import { SYSTEM_LABELS } from '../constants';
import { labelsToGroupedOptions } from '../functions';
import { TimeSeriesList } from '../types/query';
import { MetricDescriptor } from '../types/types';

import { Aggregation } from './Aggregation';

export interface Props {
  refId: string;
  variableOptionGroup: SelectableValue<string>;
  labels: string[];
  metricDescriptor?: MetricDescriptor;
  onChange: (query: TimeSeriesList) => void;
  query: TimeSeriesList;
}

export const GroupBy = ({
  refId,
  labels: groupBys = [],
  query,
  onChange,
  variableOptionGroup,
  metricDescriptor,
}: Props) => {
  const options = useMemo(
    () => [variableOptionGroup, ...labelsToGroupedOptions([...groupBys, ...SYSTEM_LABELS])],
    [groupBys, variableOptionGroup]
  );

  return (
    <EditorFieldGroup>
      <EditorField
        label="Group by"
        tooltip="You can reduce the amount of data returned for a metric by combining different time series. To combine multiple time series, you can specify a grouping and a function. Grouping is done on the basis of labels. The grouping function is used to combine the time series in the group into a single time series."
      >
        <MultiSelect
          allowCustomValue
          inputId={`${refId}-group-by`}
          width="auto"
          placeholder="Choose label"
          options={options}
          value={query.groupBys ?? []}
          onChange={(options) => {
            onChange({ ...query, groupBys: options.map((o) => o.value!) });
          }}
          menuPlacement="top"
        />
      </EditorField>
      <Aggregation
        metricDescriptor={metricDescriptor}
        templateVariableOptions={variableOptionGroup.options}
        crossSeriesReducer={query.crossSeriesReducer}
        groupBys={query.groupBys ?? []}
        onChange={(crossSeriesReducer) => onChange({ ...query, crossSeriesReducer })}
        refId={refId}
      />
    </EditorFieldGroup>
  );
};
