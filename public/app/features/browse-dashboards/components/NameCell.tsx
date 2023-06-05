import { css } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Link, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { Span } from '@grafana/ui/src/unstable';

import { useChildrenByParentUIDState } from '../state';
import { DashboardsTreeItem } from '../types';

import { Indent } from './Indent';

const CHEVRON_SIZE = 'md';

type NameCellProps = CellProps<DashboardsTreeItem, unknown> & {
  onFolderClick: (uid: string, newOpenState: boolean) => void;
};

export function NameCell({ row: { original: data }, onFolderClick }: NameCellProps) {
  const styles = useStyles2(getStyles);
  const { item, level, isOpen } = data;
  const childrenByParentUID = useChildrenByParentUIDState();

  if (item.kind === 'ui') {
    return (
      <>
        <Indent level={level} />
        <span className={styles.folderButtonSpacer} />
        {item.uiKind === 'empty-folder' ? (
          <em className={styles.emptyText}>
            <Span variant="body" color="secondary" truncate>
              No items
            </Span>
          </em>
        ) : (
          <Skeleton width={200} />
        )}
      </>
    );
  }

  // we change the icon to a spinner here instead of actually using the <Spinner /> component
  // conditionally rendering <Spinner /> here would lose focus on the button and break keyboard a11y
  const getIcon = () => {
    if (isOpen) {
      return !childrenByParentUID[item.uid] ? 'fa fa-spinner' : 'angle-down';
    } else {
      return 'angle-right';
    }
  };

  const getTooltip = () => {
    if (isOpen) {
      return !childrenByParentUID[item.uid] ? 'Fetching folder contents...' : 'Collapse folder';
    } else {
      return 'Expand folder';
    }
  };

  return (
    <>
      <Indent level={level} />

      {item.kind === 'folder' ? (
        <IconButton
          size={CHEVRON_SIZE}
          className={styles.button}
          onClick={isOpen && !childrenByParentUID[item.uid] ? undefined : () => onFolderClick(item.uid, !isOpen)}
          name={getIcon()}
          tooltip={getTooltip()}
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
    button: css({
      height: getSvgSize(CHEVRON_SIZE),
      marginRight: theme.spacing(1),
      width: getSvgSize(CHEVRON_SIZE),
    }),
    emptyText: css({
      // needed for text to truncate correctly
      overflow: 'hidden',
    }),
    // Should be the same size as the <IconButton /> so Dashboard name is aligned to Folder name siblings
    folderButtonSpacer: css({
      paddingLeft: `calc(${getSvgSize(CHEVRON_SIZE)}px + ${theme.spacing(1)})`,
    }),
    link: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    spinner: css({
      marginRight: theme.spacing(0.5),
    }),
  };
};
