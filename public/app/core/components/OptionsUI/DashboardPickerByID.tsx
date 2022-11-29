import debounce from 'debounce-promise';
import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit } from 'app/features/search/types';

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
  /** List of dashboard UIDs to be excluded from the select options */
  excludedDashboards?: string[];
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
  excludedDashboards,
}) => {
  const debouncedSearch = debounce((query: string) => getDashboards(query || '', optionLabel, excludedDashboards), 300);
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

async function getDashboards(
  query: string,
  label: string,
  excludedDashboards?: string[]
): Promise<Array<SelectableValue<DashboardPickerItem>>> {
  // FIXME: stop using id from search and use UID instead
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const result = (await backendSrv.search({ type: 'dash-db', query, limit: 100 })) as DashboardSearchHit[];
  const dashboards = result.map(({ id, uid = '', title, folderTitle }) => {
    const value: DashboardPickerItem = {
      id: id!,
      uid,
      [label]: `${folderTitle ?? 'General'}/${title}`,
    };

    return { value, [label]: value[label] };
  });

  if (excludedDashboards) {
    return dashboards.filter(({ value }) => !excludedDashboards.includes(value.uid));
  }

  return dashboards;
}
