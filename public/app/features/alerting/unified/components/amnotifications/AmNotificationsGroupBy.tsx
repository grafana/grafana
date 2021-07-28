import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';
import React from 'react';
import { uniq } from 'lodash';
import { Icon, MultiSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

interface Props {
  groups: AlertmanagerGroup[];
  handleGroupingChange: (keys: string[]) => void;
}

export const AmNotificationsGroupBy = ({ groups, handleGroupingChange }: Props) => {
  const labelKeyOptions = uniq(
    groups.reduce((keys, group) => {
      group.alerts.forEach(({ labels }) => {
        Object.keys(labels).forEach((label) => keys.push(label));
      });

      return keys;
    }, [] as string[])
  ).map(
    (key) =>
      ({
        label: key,
        value: key,
      } as SelectableValue)
  );

  return (
    <div>
      <MultiSelect
        placeholder="Group by"
        prefix={<Icon name={'tag-alt'} />}
        onChange={(items) => {
          handleGroupingChange(items.map(({ value }) => value as string));
        }}
        options={labelKeyOptions}
      />
    </div>
  );
};
