import React, { FC, ReactElement } from 'react';
import { Icon, SegmentAsync } from '@grafana/ui';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
import { DataSourceRef, SelectableValue } from '@grafana/data';

interface Props {
  datasource: DataSourceRef;
  filterKey: string | null;
  onChange: (item: SelectableValue<string | null>) => void;
}

const MIN_WIDTH = 90;
export const AdHocFilterKey: FC<Props> = ({ datasource, onChange, filterKey }) => {
  const loadKeys = () => fetchFilterKeys(datasource);
  const loadKeysWithRemove = () => fetchFilterKeysWithRemove(datasource);

  if (filterKey === null) {
    return (
      <div className="gf-form" data-testid="AdHocFilterKey-add-key-wrapper">
        <SegmentAsync
          className="query-segment-key"
          Component={plusSegment}
          value={filterKey}
          onChange={onChange}
          loadOptions={loadKeys}
          inputMinWidth={MIN_WIDTH}
        />
      </div>
    );
  }

  return (
    <div className="gf-form" data-testid="AdHocFilterKey-key-wrapper">
      <SegmentAsync
        className="query-segment-key"
        value={filterKey}
        onChange={onChange}
        loadOptions={loadKeysWithRemove}
        inputMinWidth={MIN_WIDTH}
      />
    </div>
  );
};

export const REMOVE_FILTER_KEY = '-- remove filter --';
const REMOVE_VALUE = { label: REMOVE_FILTER_KEY, value: REMOVE_FILTER_KEY };

const plusSegment: ReactElement = (
  <a className="gf-form-label query-part" aria-label="Add Filter">
    <Icon name="plus" />
  </a>
);

const fetchFilterKeys = async (datasource: DataSourceRef): Promise<Array<SelectableValue<string>>> => {
  const ds = await getDatasourceSrv().get(datasource);

  if (!ds || !ds.getTagKeys) {
    return [];
  }

  const metrics = await ds.getTagKeys();
  return metrics.map((m) => ({ label: m.text, value: m.text }));
};

const fetchFilterKeysWithRemove = async (datasource: DataSourceRef): Promise<Array<SelectableValue<string>>> => {
  const keys = await fetchFilterKeys(datasource);
  return [REMOVE_VALUE, ...keys];
};
