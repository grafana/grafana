import React, { FC, MouseEvent } from 'react';
import { css, cx } from '@emotion/css';
import { Icon, IconButton, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

import { TagBadge } from '../../core/components/TagFilter/TagBadge';
import { PlaylistItem } from './types';
import { selectors } from '@grafana/e2e-selectors';

interface PlaylistTableRowProps {
  first: boolean;
  last: boolean;
  item: PlaylistItem;
  onMoveUp: (item: PlaylistItem) => void;
  onMoveDown: (item: PlaylistItem) => void;
  onDelete: (item: PlaylistItem) => void;
}

export const PlaylistTableRow: FC<PlaylistTableRowProps> = ({ item, onDelete, onMoveDown, onMoveUp, first, last }) => {
  const styles = useStyles(getStyles);
  const onDeleteClick = (event: MouseEvent) => {
    event.preventDefault();
    onDelete(item);
  };
  const onMoveDownClick = (event: MouseEvent) => {
    event.preventDefault();
    onMoveDown(item);
  };
  const onMoveUpClick = (event: MouseEvent) => {
    event.preventDefault();
    onMoveUp(item);
  };

  return (
    <tr aria-label={selectors.pages.PlaylistForm.itemRow} key={item.title}>
      {item.type === 'dashboard_by_id' ? (
        <td className={cx(styles.td, styles.item)}>
          <Icon name="apps" aria-label={selectors.pages.PlaylistForm.itemIdType} />
          <span>{item.title}</span>
        </td>
      ) : null}
      {item.type === 'dashboard_by_tag' ? (
        <td className={cx(styles.td, styles.item)}>
          <Icon name="tag-alt" aria-label={selectors.pages.PlaylistForm.itemTagType} />
          <TagBadge key={item.id} label={item.title} removeIcon={false} count={0} />
        </td>
      ) : null}
      <td className={cx(styles.td, styles.settings)}>
        {!first ? (
          <IconButton
            name="arrow-up"
            size="md"
            onClick={onMoveUpClick}
            aria-label={selectors.pages.PlaylistForm.itemMoveUp}
            type="button"
          />
        ) : null}
        {!last ? (
          <IconButton
            name="arrow-down"
            size="md"
            onClick={onMoveDownClick}
            aria-label={selectors.pages.PlaylistForm.itemMoveDown}
            type="button"
          />
        ) : null}
        <IconButton
          name="times"
          size="md"
          onClick={onDeleteClick}
          aria-label={selectors.pages.PlaylistForm.itemDelete}
          type="button"
        />
      </td>
    </tr>
  );
};

function getStyles(theme: GrafanaTheme) {
  return {
    td: css`
      label: td;
      line-height: 28px;
      max-width: 335px;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    `,
    item: css`
      label: item;
      span {
        margin-left: ${theme.spacing.xs};
      }
    `,
    settings: css`
      label: settings;
      text-align: right;
    `,
  };
}
