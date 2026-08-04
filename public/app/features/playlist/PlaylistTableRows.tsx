import { css } from '@emotion/css';
import { Draggable, type DraggableProvided } from '@hello-pangea/dnd';
import pluralize from 'pluralize';
import { type ReactNode, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Icon, IconButton, Input, Spinner, Text, useStyles2, type IconName } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

import { type PlaylistItemUI } from './types';
import { isValidInterval } from './utils';

interface Props {
  items: PlaylistItemUI[];
  onDelete: (idx: number) => void;
  /** Placeholder for empty per-item intervals; the global interval used as fallback during playback. */
  intervalPlaceholder?: string;
  onUpdateInterval?: (idx: number, interval: string) => void;
  onUpdateQueryParams?: (idx: number, queryParams: string) => void;
}

export const PlaylistTableRows = ({
  items,
  onDelete,
  intervalPlaceholder,
  onUpdateInterval,
  onUpdateQueryParams,
}: Props) => {
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

  const renderItem = (item: PlaylistItemUI) => {
    let icon: IconName = item.type === 'dashboard_by_tag' ? 'apps' : 'tag-alt';
    const info: ReactNode[] = [];

    const first = item.dashboards?.[0];
    if (!item.dashboards) {
      info.push(<Spinner key="spinner" />);
    } else if (item.type === 'dashboard_by_tag') {
      info.push(<TagBadge key={item.value} label={item.value} removeIcon={false} count={0} />);
      if (!first) {
        icon = 'exclamation-triangle';
        info.push(
          <span key="no-dashboards">
            &nbsp;{' '}
            <span key="info">
              <Trans i18nKey="playlist.playlist-table-rows.no-dashboards-found">No dashboards found</Trans>
            </span>
          </span>
        );
      } else {
        info.push(<span key="info">&nbsp; {pluralize('dashboard', item.dashboards.length, true)}</span>);
      }
    } else if (first) {
      info.push(
        item.dashboards.length > 1 ? (
          <span key="multiple-dashboards">
            &nbsp;{' '}
            <span key="info">
              <Trans i18nKey="playlist.playlist-table-rows.multiple-dashboards-found" values={{ items: item.value }}>
                Multiple items found: {'{{items}}'}
              </Trans>
            </span>
          </span>
        ) : (
          <span key="info">{first.name ?? item.value}</span>
        )
      );
    } else {
      icon = 'exclamation-triangle';
      info.push(
        <span key="not-found">
          &nbsp;{' '}
          <span key="info">
            <Trans i18nKey="playlist.playlist-table-rows.not-found" values={{ items: item.value }}>
              Not found: {'{{items}}'}
            </Trans>
          </span>
        </span>
      );
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
        <PlaylistTableRow
          key={`${index}/${item.value}`}
          item={item}
          index={index}
          styles={styles}
          renderItem={renderItem}
          onDelete={onDelete}
          intervalPlaceholder={intervalPlaceholder}
          onUpdateInterval={onUpdateInterval}
          onUpdateQueryParams={onUpdateQueryParams}
        />
      ))}
    </>
  );
};

interface RowProps extends Omit<Props, 'items'> {
  item: PlaylistItemUI;
  index: number;
  styles: ReturnType<typeof getStyles>;
  renderItem: (item: PlaylistItemUI) => ReactNode;
}

function PlaylistTableRow({
  item,
  index,
  styles,
  renderItem,
  onDelete,
  intervalPlaceholder,
  onUpdateInterval,
  onUpdateQueryParams,
}: RowProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const optionsId = useId();
  const optionSummary = [
    item.interval,
    item.queryParams ? t('playlist.playlist-table-rows.query-params-addon', 'Parameters') : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Draggable draggableId={`${index}`} index={index}>
      {(provided: DraggableProvided) => (
        <div className={styles.row} ref={provided.innerRef} {...provided.draggableProps} role="row">
          <div
            className={styles.itemInfo}
            role="cell"
            aria-label={t(
              'playlist.playlist-table-rows.aria-label-playlist-item',
              'Playlist item, {{itemType}}, {{itemValue}}',
              { itemType: item.type, itemValue: item.value }
            )}
          >
            {renderItem(item)}
          </div>
          <div className={styles.rowActions}>
            {!optionsOpen && optionSummary && (
              <span className={styles.optionSummary}>
                <Text variant="bodySmall" color="secondary">
                  {optionSummary}
                </Text>
              </span>
            )}
            <IconButton
              name="cog"
              size="md"
              variant={optionsOpen ? 'primary' : 'secondary'}
              aria-expanded={optionsOpen}
              aria-controls={optionsId}
              tooltip={t('playlist.playlist-table-rows.settings', 'Settings')}
              tooltipPlacement="top"
              onClick={() => setOptionsOpen((open) => !open)}
            />
            <div {...provided.dragHandleProps}>
              <Icon
                title={t('playlist-edit.form.table-drag', 'Reorder playlist item')}
                name="draggabledots"
                size="md"
              />
            </div>
            <div className={styles.deleteAction}>
              {deleteConfirmationOpen ? (
                <div className={styles.deleteConfirmation}>
                  <Button autoFocus fill="text" size="sm" onClick={() => setDeleteConfirmationOpen(false)}>
                    <Trans i18nKey="playlist-edit.form.table-cancel-delete">Cancel</Trans>
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => onDelete(index)}>
                    <Trans i18nKey="playlist-edit.form.table-confirm-delete">Delete</Trans>
                  </Button>
                </div>
              ) : (
                <IconButton
                  className={styles.deleteButton}
                  name="trash-alt"
                  size="md"
                  variant="destructive"
                  data-testid={selectors.pages.PlaylistForm.itemDelete}
                  tooltip={t('playlist-edit.form.table-delete', 'Delete playlist item')}
                  tooltipPlacement="top"
                  onClick={() => setDeleteConfirmationOpen(true)}
                />
              )}
            </div>
          </div>
          {optionsOpen && (
            <div className={styles.options} id={optionsId}>
              <Field noMargin label={t('playlist.playlist-table-rows.query-params-addon', 'Parameters')}>
                <Input
                  type="text"
                  value={item.queryParams ?? ''}
                  placeholder={t(
                    'playlist.playlist-table-rows.query-params-placeholder',
                    'var-host=host1&from=now-6h&to=now'
                  )}
                  title={t(
                    'playlist.playlist-table-rows.query-params-title',
                    'Paste a dashboard URL or enter its query parameters'
                  )}
                  aria-label={t(
                    'playlist.playlist-table-rows.aria-label-item-query-params',
                    'URL parameters for {{itemValue}}',
                    { itemValue: item.value }
                  )}
                  onChange={(e) => onUpdateQueryParams?.(index, e.currentTarget.value)}
                />
              </Field>
              <Field noMargin label={t('playlist.playlist-table-rows.interval-addon', 'Interval')}>
                <Input
                  type="text"
                  // Controlled so the value always reflects the correct item after a
                  // reorder and stays synced for submission/validation on every keystroke.
                  value={item.interval ?? ''}
                  placeholder={intervalPlaceholder}
                  invalid={!!item.interval && !isValidInterval(item.interval)}
                  title={
                    !!item.interval && !isValidInterval(item.interval)
                      ? t('playlist.playlist-table-rows.invalid-interval', 'Invalid interval (e.g. 30s, 5m, 1h)')
                      : undefined
                  }
                  aria-label={t('playlist.playlist-table-rows.aria-label-item-interval', 'Interval for {{itemValue}}', {
                    itemValue: item.value,
                  })}
                  onChange={(e) => onUpdateInterval?.(index, e.currentTarget.value.trim())}
                />
              </Field>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      columnGap: theme.spacing(1),
      alignItems: 'center',
      marginBottom: theme.spacing(0.5),

      border: `1px solid ${theme.colors.border.medium}`,
      '&:hover': {
        border: `1px solid ${theme.colors.border.strong}`,
      },
    }),
    rightMargin: css({
      marginRight: '5px',
    }),
    itemInfo: css({
      alignItems: 'center',
      display: 'flex',
      minWidth: 0,
    }),
    rowActions: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    optionSummary: css({
      whiteSpace: 'nowrap',
    }),
    deleteAction: css({
      alignItems: 'center',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      minHeight: theme.spacing(3),
      marginLeft: theme.spacing(0.5),
      padding: theme.spacing(0, 0.5, 0, 1),
    }),
    deleteButton: css({
      margin: 0,
    }),
    deleteConfirmation: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    options: css({
      display: 'grid',
      gridColumn: '1 / -1',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(88px, 120px)',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: 'minmax(0, 1fr)',
      },
    }),
  };
}
