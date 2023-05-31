import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Link, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { Span, TextModifier } from '@grafana/ui/src/unstable';

import { DashboardsTreeItem } from '../types';

import { Indent } from './Indent';

type NameCellProps = CellProps<DashboardsTreeItem, unknown> & {
  onFolderClick: (uid: string, newOpenState: boolean) => void;
};

export function NameCell({ row: { original: data }, onFolderClick }: NameCellProps) {
  const styles = useStyles2(getStyles);
  const { item, level, isOpen } = data;

  if (item.kind === 'ui-empty-folder') {
    return (
      <>
        <Indent level={level} />
        <span className={styles.folderButtonSpacer} />
        <em>
          <TextModifier color="secondary">No items</TextModifier>
        </em>
      </>
    );
  }

  const chevronIcon = isOpen ? 'angle-down' : 'angle-right';

  return (
    <>
      <Indent level={level} />

      {item.kind === 'folder' ? (
        <IconButton
          size="md"
          onClick={() => onFolderClick(item.uid, !isOpen)}
          name={chevronIcon}
          ariaLabel={isOpen ? 'Collapse folder' : 'Expand folder'}
        />
      ) : (
        <span className={styles.folderButtonSpacer} />
      )}

      <Span variant="body" truncate>
        {item.url ? (
          <Link href={item.url} className={styles.link}>
            {item.title}
          </Link>
        ) : (
          item.title
        )}
      </Span>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    // Should be the same size as the <IconButton /> so Dashboard name is aligned to Folder name siblings
    folderButtonSpacer: css({
      paddingLeft: `calc(${getSvgSize('md')}px + ${theme.spacing(0.5)})`,
    }),
    link: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
