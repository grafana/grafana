import React, { FC } from 'react';
import debounce from 'debounce-promise';
import { SelectableValue } from '@grafana/data';
import { AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit } from 'app/features/search/types';

/**
 * @deprecated prefer using dashboard uid rather than id
 */
export interface DashboardPickerItem extends SelectableValue<number> {
  id: number;
  uid: string;
  value: number;
  label: string;
}

interface Props {
  onChange: (dashboard: DashboardPickerItem) => void;
  value?: DashboardPickerItem;
  width?: number;
  isClearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
}

const getDashboards = (query = '') => {
  return backendSrv.search({ type: 'dash-db', query, limit: 100 }).then((result: DashboardSearchHit[]) => {
    return result.map((item: DashboardSearchHit) => ({
      id: item.id,
      uid: item.uid,
      value: item.id,
      label: `${item?.folderTitle ?? 'General'}/${item.title}`,
    }));
  });
};

/**
 * @deprecated prefer using dashboard uid rather than id
 */
export const DashboardPickerByID: FC<Props> = ({
  onChange,
  value,
  width,
  isClearable = false,
  invalid,
  disabled,
  id,
}) => {
  const debouncedSearch = debounce(getDashboards, 300);

  return (
    <AsyncSelect
      inputId={id}
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
