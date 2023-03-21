import React from 'react';

import { DataSourceRef, MetricFindValue, SelectableValue } from '@grafana/data';
import { SegmentAsync } from '@grafana/ui';

import { getDatasourceSrv } from '../../../plugins/datasource_srv';

interface Props {
  datasource: DataSourceRef;
  filterKey: string;
  filterValue?: string;
  onChange: (item: SelectableValue<string>) => void;
  placeHolder?: string;
  disabled?: boolean;
}

export const AdHocFilterValue = ({ datasource, disabled, onChange, filterKey, filterValue, placeHolder }: Props) => {
  const loadValues = () => fetchFilterValues(datasource, filterKey);

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

const fetchFilterValues = async (datasource: DataSourceRef, key: string): Promise<Array<SelectableValue<string>>> => {
  const ds = await getDatasourceSrv().get(datasource);

  if (!ds || !ds.getTagValues) {
    return [];
  }

  const metrics = await ds.getTagValues({ key });
  return metrics.map((m: MetricFindValue) => ({ label: m.text, value: m.text }));
};
