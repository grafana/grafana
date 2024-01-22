import React from 'react';

import {
  AdHocVariableFilter,
  DataSourceRef,
  MetricFindValue,
  SelectableValue,
  getDefaultTimeRange,
} from '@grafana/data';
// import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getDataSourceSrv } from '@grafana/runtime';
import { SegmentAsync } from '@grafana/ui';

interface Props {
  datasource: DataSourceRef;
  filterKey: string;
  filterValue?: string;
  onChange: (item: SelectableValue<string>) => void;
  placeHolder?: string;
  disabled?: boolean;
  allFilters: AdHocVariableFilter[];
}

export const AdHocFilterValue = ({
  datasource,
  disabled,
  onChange,
  filterKey,
  filterValue,
  placeHolder,
  allFilters,
}: Props) => {
  const loadValues = () => fetchFilterValues(datasource, filterKey, allFilters);

  return (
    <div className="gf-form" data-testid="AdHocFilterValue-value-wrapper">
      <SegmentAsync
        className="query-segment-value"
        disabled={disabled}
        placeholder={placeHolder}
        value={filterValue}
        onChange={onChange}
        loadOptions={loadValues}
      />
    </div>
  );
};

const fetchFilterValues = async (
  datasource: DataSourceRef,
  key: string,
  allFilters: AdHocVariableFilter[]
): Promise<Array<SelectableValue<string>>> => {
  const ds = await getDataSourceSrv().get(datasource);

  if (!ds || !ds.getTagValues) {
    return [];
  }

  // const timeRange = getTimeSrv().timeRange();
  // As https://github.com/grafana/grafana/pull/76118/files#diff-260d46415915a2e3e7d294e313bd128666e9f0868aa94d8aee4d4a24a060b542L27-R26
  const timeRange = getDefaultTimeRange();

  // Filter out the current filter key from the list of all filters
  const otherFilters = allFilters.filter((f) => f.key !== key);
  const metrics = await ds.getTagValues({ key, filters: otherFilters, timeRange });
  return metrics.map((m: MetricFindValue) => ({ label: m.text, value: m.text }));
};
