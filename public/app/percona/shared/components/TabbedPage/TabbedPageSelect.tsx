import React, { FC, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Select } from '@grafana/ui';

import { TabbedPageSelectProps } from './TabbedPageSelect.types';

export const TabbedPageSelect: FC<TabbedPageSelectProps> = ({ tabs, className }) => {
  const options = useMemo<SelectableValue[]>(
    () =>
      tabs.map((tab) => ({
        label: tab.text,
        title: tab.text,
        value: tab.id,
        url: tab.url,
      })),
    [tabs]
  );
  const value = useMemo(() => tabs.find((tab) => tab.active), [tabs]);

  return (
    <div className={className}>
      <Select
        options={options}
        value={value?.id}
        onChange={(item) => locationService.push(item.url.replace('/graph', ''))}
        isSearchable={false}
        isClearable={false}
      />
    </div>
  );
};
