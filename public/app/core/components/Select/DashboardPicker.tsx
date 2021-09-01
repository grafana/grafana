import React, { FC } from 'react';
import debounce from 'debounce-promise';
import { SelectableValue } from '@grafana/data';
import { AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit } from 'app/features/search/types';

export interface DashboardPickerItem extends Pick<DashboardSearchHit, 'uid' | 'id'> {
  value: number;
  label: string;
}

export interface Props {
  onChange: (dashboard: DashboardPickerItem) => void;
  value?: SelectableValue;
  width?: number;
  isClearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}

const getDashboards = (query = '') => {
  return backendSrv.search({ type: 'dash-db', query }).then((result: DashboardSearchHit[]) => {
    return result.map((item: DashboardSearchHit) => ({
      id: item.id,
      uid: item.uid,
      value: item.id,
      label: `${item?.folderTitle ?? 'General'}/${item.title}`,
    }));
  });
};

export const DashboardPicker: FC<Props> = ({ onChange, value, width, isClearable = false, invalid, disabled }) => {
  const debouncedSearch = debounce(getDashboards, 300);

  return (
    <AsyncSelect
      menuShouldPortal
      width={width}
      isClearable={isClearable}
      defaultOptions={true}
      loadOptions={debouncedSearch}
      onChange={onChange}
      placeholder="Select dashboard"
      noOptionsMessage="No dashboards found"
      value={value}
      invalid={invalid}
      disabled={disabled}
    />
  );
};
