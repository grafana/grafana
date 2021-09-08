import React, { FC, useCallback, useEffect, useState } from 'react';
import debounce from 'debounce-promise';
import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { DashboardSearchHit } from 'app/features/search/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { AsyncSelect } from '@grafana/ui';

export interface DashboardPickerOptions {
  placeholder?: string;
  isClearable?: boolean;
}

const getDashboards = (query = '') => {
  return backendSrv.search({ type: 'dash-db', query }).then((result: DashboardSearchHit[]) => {
    return result.map((item: DashboardSearchHit) => ({
      uid: item.uid,
      value: item.uid,
      label: `${item?.folderTitle ?? 'General'}/${item.title}`,
    }));
  });
};

export const DashboardPicker: FC<StandardEditorProps<string, any, any>> = ({ value, onChange, item }) => {
  const [current, setCurrent] = useState<SelectableValue<string>>();

  useEffect(() => {
    if (!value) {
      setCurrent(undefined);
      return;
    }
    (async function loadDashboard() {
      const res = await backendSrv.getDashboardByUid(value);
      setCurrent({
        value: res.dashboard.uid,
        label: `${res.meta?.folderTitle ?? 'General'}/${res.dashboard.title}`,
      });
    })();
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
