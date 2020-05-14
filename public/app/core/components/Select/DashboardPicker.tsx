import React, { FC } from 'react';
import { debounce } from 'lodash';
import { useAsyncFn } from 'react-use';
import { SelectableValue } from '@grafana/data';
import { AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit } from 'app/features/search/types';
import { DashboardDTO } from 'app/types';

export interface Props {
  onSelected: (dashboard: DashboardDTO) => void;
  currentDashboard?: SelectableValue<number>;
  width?: number;
  isClearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}

const getDashboards = (query = '') => {
  return backendSrv.search({ type: 'dash-db', query }).then((result: DashboardSearchHit[]) => {
    return result.map((item: DashboardSearchHit) => ({
      id: item.id,
      value: item.id,
      label: `${item.folderTitle ? item.folderTitle : 'General'}/${item.title}`,
    }));
  });
};

export const DashboardPicker: FC<Props> = ({
  onSelected,
  currentDashboard,
  width,
  isClearable = false,
  invalid,
  disabled,
}) => {
  const debouncedSearch = debounce(getDashboards, 300, {
    leading: true,
    trailing: true,
  });

  const [state, searchDashboards] = useAsyncFn(debouncedSearch, []);

  return (
    <AsyncSelect
      width={width}
      isLoading={state.loading}
      isClearable={isClearable}
      defaultOptions={true}
      loadOptions={searchDashboards}
      onChange={onSelected}
      placeholder="Select dashboard"
      noOptionsMessage="No dashboards found"
      value={currentDashboard}
      invalid={invalid}
      disabled={disabled}
    />
  );
};
