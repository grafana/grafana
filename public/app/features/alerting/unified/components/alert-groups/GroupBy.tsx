import { uniq } from 'lodash';
import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Icon, Label, MultiSelect } from '@grafana/ui';
import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

interface Props {
  className?: string;
  groups: AlertmanagerGroup[];
  groupBy: string[];
  onGroupingChange: (keys: string[]) => void;
}

export const GroupBy = ({ className, groups, groupBy, onGroupingChange }: Props) => {
  const labelKeyOptions = uniq(groups.flatMap((group) => group.alerts).flatMap(({ labels }) => Object.keys(labels)))
    .filter((label) => !(label.startsWith('__') && label.endsWith('__'))) // Filter out private labels
    .map<SelectableValue>((key) => ({
      label: key,
      value: key,
    }));

  return (
    <div data-testid={'group-by-container'} className={className}>
      <Label>Custom group by</Label>
      <MultiSelect
        aria-label={'group by label keys'}
        value={groupBy}
        placeholder="Group by"
        prefix={<Icon name={'tag-alt'} />}
        onChange={(items) => {
          onGroupingChange(items.map(({ value }) => value as string));
        }}
        options={labelKeyOptions}
      />
    </div>
  );
};
