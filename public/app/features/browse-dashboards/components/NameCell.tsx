import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, Link, Spinner, useStyles2 } from '@grafana/ui';
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
  const chevronRef = useRef<HTMLButtonElement>(null);
  const isLoading = isOpen && !childrenByParentUID[item.uid];
  const [shouldRestoreFocus, setShouldRestoreFocus] = useState(false);

  // restore focus back to the original button when loading is complete
  useEffect(() => {
    if (!isLoading && chevronRef.current && shouldRestoreFocus) {
      chevronRef.current.focus();
      setShouldRestoreFocus(false);
    }
  }, [isLoading, shouldRestoreFocus]);

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

  return (
    <>
      <Indent level={level} />

      {item.kind === 'folder' ? (
        <>
          {isLoading ? (
            <Spinner className={styles.chevron} />
          ) : (
            <IconButton
              size={CHEVRON_SIZE}
              className={styles.chevron}
              ref={chevronRef}
              onClick={() => {
                if (!isOpen && !childrenByParentUID[item.uid]) {
                  setShouldRestoreFocus(true);
                }
                onFolderClick(item.uid, !isOpen);
              }}
              name={isOpen ? 'angle-down' : 'angle-right'}
              ariaLabel={isOpen ? 'Collapse folder' : 'Expand folder'}
            />
          )}
        </>
      ) : (
        <span className={styles.folderButtonSpacer} />
      )}
      <Span variant="body" truncate>
        {item.url ? (
          <Link
            onClick={() => {
              reportInteraction('manage_dashboards_result_clicked');
            }}
            href={item.url}
            className={styles.link}
          >
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
    chevron: css({
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
  };
};
