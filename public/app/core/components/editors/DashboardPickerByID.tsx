import React, { FC } from 'react';
import debounce from 'debounce-promise';
import { AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { SelectableValue } from '@grafana/data';

/**
 * @deprecated prefer using dashboard uid rather than id
 */
export interface DashboardPickerItem {
  id: number;
  uid: string;
  label: string;
}

interface Props {
  onChange: (dashboard?: DashboardPickerItem) => void;
  value?: DashboardPickerItem;
  width?: number;
  isClearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * @deprecated prefer using dashboard uid rather than id
 */
export const DashboardPickerByID: FC<Props> = ({
  onChange: propsOnChange,
  value,
  width,
  isClearable = false,
  invalid,
  disabled,
  id,
}) => {
  const debouncedSearch = debounce(getDashboards, 300);
  const option = value ? { value, label: value.label } : undefined;
  const onChange = (item: SelectableValue<DashboardPickerItem>) => {
    propsOnChange(item?.value);
  };

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
      value={option}
      invalid={invalid}
      disabled={disabled}
    />
  );
};

async function getDashboards(query = ''): Promise<Array<SelectableValue<DashboardPickerItem>>> {
  const result = await backendSrv.search({ type: 'dash-db', query, limit: 100 });
  return result.map(({ id, uid = '', title, folderTitle }) => {
    const value: DashboardPickerItem = {
      id,
      uid,
      label: `${folderTitle ?? 'General'}/${title}`,
    };

    return { value, label: value.label };
  });
}
