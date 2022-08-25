import { css } from '@emotion/css';
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';

import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, IconButton, useStyles, Spinner, HorizontalGroup } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

import { PlaylistItem } from './types';

interface PlaylistTableRowsProps {
  items: PlaylistItem[];
  onDelete: (idx: number) => void;
}

export const PlaylistTableRows = ({ items, onDelete }: PlaylistTableRowsProps) => {
  const styles = useStyles(getStyles);
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
              aria-label={selectors.pages.PlaylistForm.itemRow}
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
            >
              <div>
                <HorizontalGroup>
                  {item.type === 'dashboard_by_tag' ? (
                    <>
                      <Icon name="tag-alt" aria-label={selectors.pages.PlaylistForm.itemTagType} />
                      <TagBadge key={item.value} label={item.value} removeIcon={false} count={0} />
                      {item.dashboards ? <span>{item.dashboards.length}</span> : <Spinner />}
                    </>
                  ) : (
                    // dashboard_by_id | dashboard_by_uid
                    <>
                      <Icon name="apps" aria-label={selectors.pages.PlaylistForm.itemIdType} />
                      {item.dashboards ? <span>{item.dashboards[0]?.name}</span> : <Spinner />}
                    </>
                  )}
                </HorizontalGroup>
              </div>
              <div>
                <IconButton
                  name="times"
                  size="md"
                  onClick={() => onDelete(index)}
                  aria-label={selectors.pages.PlaylistForm.itemDelete}
                  type="button"
                />
                <Icon title="Drag and drop to reorder" name="draggabledots" size="lg" className={styles.dragIcon} />
              </div>
            </div>
          )}
        </Draggable>
      ))}
    </>
  );
};

function getStyles(theme: GrafanaTheme) {
  return {
    row: css`
      padding: ${theme.spacing.xs} ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
      background: ${theme.colors.bg2};
      min-height: ${theme.spacing.formInputHeight}px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 3px;
      cursor: pointer;

      border: 1px solid ${theme.colors.formInputBorder};
      &:hover {
        border: 1px solid ${theme.colors.formInputBorderHover};
      }
    `,
    dragIcon: css`
      cursor: drag;
    `,
    settings: css`
      label: settings;
      text-align: right;
    `,
  };
}
