import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, IconButton, useStyles2, Spinner } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

import { PlaylistItem } from './types';

interface Props {
  items: PlaylistItem[];
  onDelete: (idx: number) => void;
}

export const PlaylistTableRows = ({ items, onDelete }: Props) => {
  const styles = useStyles2(getStyles);
  if (!items?.length) {
    return (
      <div>
        <em>Playlist is empty. Add dashboards below.</em>
      </div>
    );
  }

  return (
    <>
      {items.map((item, index) => (
        <Draggable key={`${index}/${item.value}`} draggableId={`${index}`} index={index}>
          {(provided) => (
            <div
              className={styles.row}
              aria-label={`Playlist item, ${item.type}, ${item.value}`}
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              role="row"
            >
              <div className={styles.actions}>
                {item.type === 'dashboard_by_tag' ? (
                  <>
                    <Icon name="tag-alt" className={styles.rightMargin} />
                    <TagBadge key={item.value} label={item.value} removeIcon={false} count={0} />
                    {item.dashboards ? (
                      <span>&nbsp; {pluralize('dashboard', item.dashboards.length, true)}</span>
                    ) : (
                      <Spinner />
                    )}
                  </>
                ) : (
                  // dashboard_by_id | dashboard_by_uid
                  <>
                    <Icon name="apps" className={styles.rightMargin} />
                    {item.dashboards ? <span>{item.dashboards[0]?.name}</span> : <Spinner />}
                  </>
                )}
              </div>
              <div className={styles.actions}>
                <IconButton
                  name="times"
                  size="md"
                  onClick={() => onDelete(index)}
                  aria-label={selectors.pages.PlaylistForm.itemDelete}
                  type="button"
                />
                <Icon title="Drag and drop to reorder" name="draggabledots" size="md" />
              </div>
            </div>
          )}
        </Draggable>
      ))}
    </>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css`
      padding: 6px;
      background: ${theme.colors.background.secondary};
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 3px;

      border: 1px solid ${theme.colors.border.medium};
      &:hover {
        border: 1px solid ${theme.colors.border.strong};
      }
    `,
    rightMargin: css`
      margin-right: 5px;
    `,
    actions: css`
      align-items: center;
      justify-content: center;
      display: flex;
    `,
    settings: css`
      label: settings;
      text-align: right;
    `,
  };
}
