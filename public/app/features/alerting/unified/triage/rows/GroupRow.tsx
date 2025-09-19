import { css } from '@emotion/css';
import React from 'react';

import { AlertLabel } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { GenericGroupedRow } from '../types';

import { GenericRow } from './GenericRow';

interface GroupRowProps {
  row: GenericGroupedRow;
  leftColumnWidth: number;
  rowKey: React.Key;
  depth?: number;
  children?: React.ReactNode;
}

export const GroupRow = ({ row, leftColumnWidth, rowKey, depth = 0, children }: GroupRowProps) => {
  const styles = useStyles2(getStyles);

  return (
    <GenericRow
      key={rowKey}
      width={leftColumnWidth}
      title={<AlertLabel size="sm" labelKey={row.metadata.label} value={row.metadata.value} colorBy="key" />}
      isOpenByDefault={true}
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
