import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';
import React from 'react';
import { uniq } from 'lodash';
import { Icon, Label, MultiSelect, useStyles2 } from '@grafana/ui';
import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  groups: AlertmanagerGroup[];
  groupBy: string[];
  onGroupingChange: (keys: string[]) => void;
}

export const GroupBy = ({ groups, groupBy, onGroupingChange }: Props) => {
  const styles = useStyles2(getStyles);
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
    <div className={styles.wrapper}>
      <Label>Custom group by</Label>
      <MultiSelect
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

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    width: 340px;
    margin-left: ${theme.spacing(1)};
  `,
});
