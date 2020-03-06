import React, { FC } from 'react';
import { debounce } from 'lodash';
import { SelectableValue } from '@grafana/data';
import { Forms } from '@grafana/ui';
import { FormInputSize } from '@grafana/ui/src/components/Forms/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit, DashboardDTO } from 'app/types';

export interface Props {
  onSelected: (dashboard: DashboardDTO) => void;
  currentDashboardId?: SelectableValue<number>;
  size?: FormInputSize;
}

export const DashboardPicker: FC<Props> = ({ onSelected, currentDashboardId, size = 'md' }) => {
  const getDashboards = (query = '') => {
    return backendSrv.search({ type: 'dash-db', query }).then((result: DashboardSearchHit[]) => {
      const dashboards = result.map((item: DashboardSearchHit) => ({
        id: item.id,
        value: item.id,
        label: `${item.folderTitle ? item.folderTitle : 'General'}/${item.title}`,
      }));

      return dashboards;
    });
  };

  const debouncedSearch = debounce(getDashboards, 300, {
    leading: true,
    trailing: true,
  });

  return (
    <Forms.AsyncSelect
      size={size}
      isLoading={false}
      isClearable={true}
      defaultOptions={true}
      loadOptions={debouncedSearch}
      onChange={onSelected}
      placeholder="Select dashboard"
      noOptionsMessage={'No dashboards found'}
      value={currentDashboardId}
    />
  );
};
