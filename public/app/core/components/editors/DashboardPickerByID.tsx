import debounce from 'debounce-promise';
import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';

/**
 * @deprecated prefer using dashboard uid rather than id
 */
export interface DashboardPickerItem {
  id: number;
  uid: string;
  [key: string]: string | number;
}

interface Props {
  onChange: (dashboard?: DashboardPickerItem) => void;
  value?: DashboardPickerItem;
  width?: number;
  isClearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  optionLabel?: string;
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
  optionLabel = 'label',
}) => {
  const debouncedSearch = debounce((query: string) => getDashboards(query || '', optionLabel), 300);
  const option = value ? { value, [optionLabel]: value[optionLabel] } : undefined;
  const onChange = (item: SelectableValue<DashboardPickerItem>) => {
    propsOnChange(item?.value);
  };

  return (
    <AsyncSelect
      inputId={id}
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
      getOptionLabel={(option) => option[optionLabel]}
    />
  );
};

async function getDashboards(query: string, label: string): Promise<Array<SelectableValue<DashboardPickerItem>>> {
  const result = await backendSrv.search({ type: 'dash-db', query, limit: 100 });
  return result.map(({ id, uid = '', title, folderTitle }) => {
    const value: DashboardPickerItem = {
      id,
      uid,
      [label]: `${folderTitle ?? 'General'}/${title}`,
    };

    return { value, [label]: value[label] };
  });
}
