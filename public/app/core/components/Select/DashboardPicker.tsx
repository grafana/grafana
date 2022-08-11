import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { AsyncSelectProps, AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchItem } from 'app/features/search/types';
import { DashboardDTO } from 'app/types';

interface Props extends Omit<AsyncSelectProps<DashboardPickerDTO>, 'value' | 'onChange' | 'loadOptions' | ''> {
  value?: DashboardPickerDTO['uid'];
  onChange?: (value?: DashboardPickerDTO) => void;
}

export type DashboardPickerDTO = Pick<DashboardDTO['dashboard'], 'uid' | 'title'> &
  Pick<DashboardDTO['meta'], 'folderUid' | 'folderTitle'>;

const formatLabel = (folderTitle = 'General', dashboardTitle: string) => `${folderTitle}/${dashboardTitle}`;

const getDashboards = debounce((query = ''): Promise<Array<SelectableValue<DashboardPickerDTO>>> => {
  return backendSrv.search({ type: 'dash-db', query, limit: 100 }).then((result: DashboardSearchItem[]) => {
    return result.map((item: DashboardSearchItem) => ({
      value: {
        // dashboards uid here is always defined as this endpoint does not return the default home dashboard
        uid: item.uid!,
        title: item.title,
        folderTitle: item.folderTitle,
        folderUid: item.folderUid,
      },
      label: formatLabel(item?.folderTitle, item.title),
    }));
  });
}, 300);

// TODO: this component should provide a way to apply different filters to the search APIs
export const DashboardPicker = ({
  value,
  onChange,
  placeholder = 'Select dashboard',
  noOptionsMessage = 'No dashboards found',
  ...props
}: Props) => {
  const [current, setCurrent] = useState<SelectableValue<DashboardPickerDTO>>();

  // This is required because the async select does not match the raw uid value
  // We can not use a simple Select because the dashboard search should not return *everything*
  useEffect(() => {
    if (!value || value === current?.value?.uid) {
      return;
    }

    (async () => {
      // value was manually changed from outside or we are rendering for the first time.
      // We need to fetch dashboard information.
      const res = await backendSrv.getDashboardByUid(value);
      setCurrent({
        value: {
          uid: res.dashboard.uid,
          title: res.dashboard.title,
          folderTitle: res.meta.folderTitle,
          folderUid: res.meta.folderUid,
        },
        label: formatLabel(res.meta?.folderTitle, res.dashboard.title),
      });
    })();
    // we don't need to rerun this effect every time `current` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onPicked = useCallback(
    (sel: SelectableValue<DashboardPickerDTO>) => {
      setCurrent(sel);
      onChange?.(sel?.value);
    },
    [onChange, setCurrent]
  );

  return (
    <AsyncSelect
      loadOptions={getDashboards}
      onChange={onPicked}
      placeholder={placeholder}
      noOptionsMessage={noOptionsMessage}
      value={current}
      {...props}
    />
  );
};
