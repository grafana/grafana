import { css } from '@emotion/css';
import { isString } from 'lodash';
import React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Stack, Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { MetaText } from '../../components/MetaText';
import { type GenericGroupedRow } from '../types';

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
      rightColumnClassName={styles.empty}
      depth={depth}
    >
      {children}
    </GenericRow>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  folderGroupRow: css({
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  }),
  empty: css({}),
});
