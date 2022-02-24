import React, { FC } from 'react';
import { SegmentAsync } from '@grafana/ui';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
import { DataSourceRef, MetricFindValue, SelectableValue } from '@grafana/data';

interface Props {
  datasource: DataSourceRef;
  filterKey: string;
  filterValue?: string;
  onChange: (item: SelectableValue<string>) => void;
  placeHolder?: string;
}

export const AdHocFilterValue: FC<Props> = ({ datasource, onChange, filterKey, filterValue, placeHolder }) => {
  const loadValues = () => fetchFilterValues(datasource, filterKey);

  return (
    <div className="gf-form" data-testid="AdHocFilterValue-value-wrapper">
      <SegmentAsync
        className="query-segment-value"
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
