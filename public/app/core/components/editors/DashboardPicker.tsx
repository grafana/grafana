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

interface DashboardPickerItem extends SelectableValue<string> {
  value: string;
  label: string;
  uid: string;
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
  const [current, setCurrent] = useState<DashboardPickerItem>();

  useEffect(() => {
    if (!value) {
      setCurrent(undefined);
      return;
    }

    let active = true;
    load();
    return () => {
      active = false;
    };

    async function load() {
      const res = await backendSrv.getDashboardByUid(value);
      if (!active) {
        return;
      }
      setCurrent({
        uid: res.dashboard.uid,
        value: res.dashboard,
        label: `${res.meta?.folderTitle ?? 'General'}/${res.dashboard.title}`,
      });
    }
  }, [value]);

  const onPicked = useCallback(
    (dashboard: DashboardPickerItem) => {
      onChange(dashboard?.uid);
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
