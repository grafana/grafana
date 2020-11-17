import React, { FC, ReactElement } from 'react';
import { Icon, SegmentAsync } from '@grafana/ui';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
import { SelectableValue } from '@grafana/data';

interface Props {
  datasource: string;
  filterKey: string | null;
  onChange: (item: SelectableValue<string | null>) => void;
}

export const AdHocFilterKey: FC<Props> = ({ datasource, onChange, filterKey }) => {
  const loadKeys = () => fetchFilterKeys(datasource);
  const loadKeysWithRemove = () => fetchFilterKeysWithRemove(datasource);

  if (filterKey === null) {
    return (
      <div className="gf-form">
        <SegmentAsync
          className="query-segment-key"
          Component={plusSegment}
          value={filterKey}
          onChange={onChange}
          loadOptions={loadKeys}
        />
      </div>
    );
  }

  return (
    <div className="gf-form">
      <SegmentAsync
        className="query-segment-key"
        value={filterKey}
        onChange={onChange}
        loadOptions={loadKeysWithRemove}
      />
    </div>
  );
};

export const REMOVE_FILTER_KEY = '-- remove filter --';
const REMOVE_VALUE = { label: REMOVE_FILTER_KEY, value: REMOVE_FILTER_KEY };

const plusSegment: ReactElement = (
  <a className="gf-form-label query-part">
    <Icon name="plus" />
  </a>
);

const fetchFilterKeys = async (datasource: string): Promise<Array<SelectableValue<string>>> => {
  const ds = await getDatasourceSrv().get(datasource);

  if (!ds || !ds.getTagKeys) {
    return [];
  }

  const metrics = await ds.getTagKeys();
  return metrics.map(m => ({ label: m.text, value: m.text }));
};

const fetchFilterKeysWithRemove = async (datasource: string): Promise<Array<SelectableValue<string>>> => {
  const keys = await fetchFilterKeys(datasource);
  return [REMOVE_VALUE, ...keys];
};
