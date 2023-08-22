import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { TagList, useStyles2 } from '@grafana/ui';

import { DashboardsTreeItem } from '../types';

export function TagsCell({ row: { original: data } }: CellProps<DashboardsTreeItem, unknown>) {
  const styles = useStyles2(getStyles);
  const item = data.item;

  if (item.kind === 'ui') {
    if (item.uiKind === 'pagination-placeholder') {
      return <TagList.Skeleton />;
    } else {
      return null;
    }
  }

  if (!item.tags) {
    return null;
  }

  return <TagList className={styles.tagList} tags={item.tags} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    // TagList is annoying and has weird default alignment
    tagList: css({
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
    }),
  };
}
