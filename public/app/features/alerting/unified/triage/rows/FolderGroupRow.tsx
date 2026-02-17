import { css } from '@emotion/css';
import { isString } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { MetaText } from '../../components/MetaText';
import { GenericGroupedRow } from '../types';

import { GenericRow } from './GenericRow';
import { RowActions } from './InstanceCountBadges';

interface FolderGroupRowProps {
  row: GenericGroupedRow;
  leftColumnWidth: number;
  rowKey: React.Key;
  depth?: number;
  children?: React.ReactNode;
}

export const FolderGroupRow = ({ row, leftColumnWidth, rowKey, depth = 0, children }: FolderGroupRowProps) => {
  const styles = useStyles2(getStyles);

  return (
    <GenericRow
      key={rowKey}
      width={leftColumnWidth}
      title={
        <Stack direction="row" gap={0.5} alignItems="center">
          <MetaText icon="folder" />
          {isString(row.metadata.value) && <Text color="primary">{row.metadata.value}</Text>}
        </Stack>
      }
      actions={<RowActions counts={row.instanceCounts} />}
      isOpenByDefault={true}
      leftColumnClassName={styles.folderGroupRow}
      rightColumnClassName={styles.folderGroupRow}
      depth={depth}
    >
      {children}
    </GenericRow>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  folderGroupRow: css({
    backgroundColor: theme.colors.background.secondary,
  }),
});
