import { css } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import pluralize from 'pluralize';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, IconButton, useStyles2, Spinner, IconName } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { t, Trans } from 'app/core/internationalization';

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
        <em>
          <Trans i18nKey="playlist-edit.form.table-empty">Playlist is empty. Add dashboards below.</Trans>
        </em>
      </div>
    );
  }

  const renderItem = (item: PlaylistItem) => {
    let icon: IconName = item.type === 'dashboard_by_tag' ? 'apps' : 'tag-alt';
    const info: ReactNode[] = [];

    const first = item.dashboards?.[0];
    if (!item.dashboards) {
      info.push(<Spinner key="spinner" />);
    } else if (item.type === 'dashboard_by_tag') {
      info.push(<TagBadge key={item.value} label={item.value} removeIcon={false} count={0} />);
      if (!first) {
        icon = 'exclamation-triangle';
        info.push(<span key="info">&nbsp; No dashboards found</span>);
      } else {
        info.push(<span key="info">&nbsp; {pluralize('dashboard', item.dashboards.length, true)}</span>);
      }
    } else if (first) {
      info.push(
        item.dashboards.length > 1 ? (
          <span key="info">Multiple items found: ${item.value}</span>
        ) : (
          <span key="info">{first.name ?? item.value}</span>
        )
      );
    } else {
      icon = 'exclamation-triangle';
      info.push(<span key="info">&nbsp; Not found: {item.value}</span>);
    }
    return (
      <>
        <Icon name={icon} className={styles.rightMargin} key="icon" />
        {info}
      </>
    );
  };

  return (
    <>
      {items.map((item, index) => (
        <Draggable key={`${index}/${item.value}`} draggableId={`${index}`} index={index}>
          {(provided) => (
            <div
              className={styles.row}
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              role="row"
            >
              <div className={styles.actions} role="cell" aria-label={`Playlist item, ${item.type}, ${item.value}`}>
                {renderItem(item)}
              </div>
              <div className={styles.actions}>
                <IconButton
                  name="times"
                  size="md"
                  onClick={() => onDelete(index)}
                  data-testid={selectors.pages.PlaylistForm.itemDelete}
                  tooltip={t('playlist-edit.form.table-delete', 'Delete playlist item')}
                />
                <Icon
                  title={t('playlist-edit.form.table-drag', 'Drag and drop to reorder')}
                  name="draggabledots"
                  size="md"
                />
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
    row: css({
      padding: theme.spacing(0.75),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '3px',

      border: `1px solid ${theme.colors.border.medium}`,
      '&:hover': {
        border: `1px solid ${theme.colors.border.strong}`,
      },
    }),
    rightMargin: css({
      marginRight: '5px',
    }),
    actions: css({
      alignItems: 'center',
      justifyContent: 'center',
      display: 'flex',
    }),
    settings: css({
      label: 'settings',
      textAlign: 'right',
    }),
  };
}
