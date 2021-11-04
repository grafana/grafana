import React, { FC, useCallback, useState } from 'react';
import debounce from 'debounce-promise';
import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { DashboardSearchHit } from 'app/features/search/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { AsyncSelect } from '@grafana/ui';
import { useAsync } from 'react-use';

export interface DashboardPickerOptions {
  placeholder?: string;
  isClearable?: boolean;
}

const getDashboards = (query = '') => {
  return backendSrv.search({ type: 'dash-db', query, limit: 100 }).then((result: DashboardSearchHit[]) => {
    return result.map((item: DashboardSearchHit) => ({
      value: item.uid,
      label: `${item?.folderTitle ?? 'General'}/${item.title}`,
    }));
  });
};

/** This will return the item UID */
export const DashboardPicker: FC<StandardEditorProps<string, any, any>> = ({ value, onChange, item }) => {
  const [current, setCurrent] = useState<SelectableValue<string>>();

  // This is required because the async select does not match the raw uid value
  // We can not use a simple Select because the dashboard search should not return *everything*
  useAsync(async () => {
    if (!value) {
      setCurrent(undefined);
      return;
    }
    const res = await backendSrv.getDashboardByUid(value);
    setCurrent({
      value: res.dashboard.uid,
      label: `${res.meta?.folderTitle ?? 'General'}/${res.dashboard.title}`,
    });
    return undefined;
  }, [value]);

  const onPicked = useCallback(
    (sel: SelectableValue<string>) => {
      onChange(sel?.value);
    },
    [onChange]
  );
  const debouncedSearch = debounce(getDashboards, 300);
  const { placeholder, isClearable } = item?.settings ?? {};

  return (
    <AsyncSelect
      menuShouldPortal
      isClearable={isClearable}
      defaultOptions={true}
      loadOptions={debouncedSearch}
      onChange={onPicked}
      placeholder={placeholder ?? 'Select dashboard'}
      noOptionsMessage="No dashboards found"
      value={current}
    />
  );
};
