import React, { FC } from 'react';
import { SegmentAsync } from '@grafana/ui';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
import { MetricFindValue, SelectableValue } from '@grafana/data';

interface Props {
  datasource: string;
  filterKey: string;
  filterValue: string | null;
  onChange: (item: SelectableValue<string>) => void;
  placeHolder?: string;
}

export const AdHocFilterValue: FC<Props> = ({ datasource, onChange, filterKey, filterValue, placeHolder }) => {
  const loadValues = () => fetchFilterValues(datasource, filterKey);

  return (
    <div className="gf-form">
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

const fetchFilterValues = async (datasource: string, key: string): Promise<Array<SelectableValue<string>>> => {
  const ds = await getDatasourceSrv().get(datasource);

  if (!ds || !ds.getTagValues) {
    return [];
  }

  const metrics = await ds.getTagValues({ key });
  return metrics.map((m: MetricFindValue) => ({ label: m.text, value: m.text }));
};
