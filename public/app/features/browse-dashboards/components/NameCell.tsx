import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { Icon, IconButton, Link, useStyles2 } from '@grafana/ui';
import { getIconForKind } from 'app/features/search/service/utils';

import { DashboardsTreeItem } from '../types';

import { Indented } from './Indented';

type NameCellProps = CellProps<DashboardsTreeItem, unknown> & {
  onFolderClick: (uid: string, newOpenState: boolean) => void;
};

export function NameCell({ row: { original: data }, onFolderClick }: NameCellProps) {
  const styles = useStyles2(getStyles);
  const { item, level, isOpen } = data;

  if (item.kind === 'ui-empty-folder') {
    return (
      <Indented level={level}>
        <em>Empty folder</em>
      </Indented>
    );
  }

  const chevronIcon = isOpen ? 'angle-down' : 'angle-right';

  let iconName = getIconForKind(item.kind);
  if (item.kind === 'folder' && isOpen) {
    iconName = 'folder-open';
  }

  return (
    <Indented level={level}>
      {item.kind === 'folder' ? (
        <IconButton onClick={() => onFolderClick(item.uid, !isOpen)} name={chevronIcon} />
      ) : (
        <span style={{ paddingRight: 20 }} />
      )}
      <Icon name={iconName} />{' '}
      <Link
        href={item.kind === 'folder' ? `/nested-dashboards/f/${item.uid}` : `/d/${item.uid}`}
        className={styles.link}
      >
        {item.title}
      </Link>
    </Indented>
  );
}

const getStyles = () => {
  return {
    link: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
