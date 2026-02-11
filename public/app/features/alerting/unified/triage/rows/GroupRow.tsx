import { css } from '@emotion/css';
import React from 'react';

import { AlertLabel } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { EmptyLabelValue, GenericGroupedRow } from '../types';

import { GenericRow } from './GenericRow';
import { RowActions } from './InstanceCountBadges';
import { formatLabelValue } from './utils';

interface GroupRowProps {
  row: GenericGroupedRow;
  leftColumnWidth: number;
  rowKey: React.Key;
  depth?: number;
  children?: React.ReactNode;
}

export const GroupRow = ({ row, leftColumnWidth, rowKey, depth = 0, children }: GroupRowProps) => {
  const styles = useStyles2(getStyles);
  const isEmptyValue = row.metadata.value === EmptyLabelValue;

  return (
    <GenericRow
      key={rowKey}
      width={leftColumnWidth}
      title={
        <AlertLabel
          size="sm"
          labelKey={row.metadata.label}
          value={formatLabelValue(row.metadata.value)}
          colorBy="key"
        />
      }
      actions={<RowActions counts={row.instanceCounts} />}
      isOpenByDefault={!isEmptyValue}
      leftColumnClassName={styles.groupRow}
      rightColumnClassName={styles.groupRow}
      depth={depth}
    >
      {children}
    </GenericRow>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  groupRow: css({
    backgroundColor: theme.colors.background.secondary,
  }),
});
