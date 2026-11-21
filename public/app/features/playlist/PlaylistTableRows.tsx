import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import pluralize from 'pluralize';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Icon, IconButton, Input, Tooltip, useStyles2, Spinner, type IconName } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

import { type PlaylistItemUI } from './types';
import { isValidInterval } from './utils';

interface Props {
  items: PlaylistItemUI[];
  onDelete: (idx: number) => void;
  /** Placeholder for blank per-item intervals (the global interval). */
  intervalPlaceholder?: string;
  onUpdateInterval?: (idx: number, interval: string) => void;
}

export const PlaylistTableRows = ({ items, onDelete, intervalPlaceholder, onUpdateInterval }: Props) => {
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

  const invalidMessage = t(
    'playlist.playlist-table-rows.invalid-interval',
    'Invalid interval. Use a duration such as 30s, 5m or 1h.'
  );
  const helpMessage = t(
    'playlist.playlist-table-rows.interval-help',
    'Dashboard interval, e.g. 30s, 5m or 1h. Blank uses the playlist interval.'
  );
  const dragHandleLabel = t('playlist-edit.form.table-drag', 'Reorder playlist item');

  return (
    <>
      {items.map((item, index) => {
        const isInvalid = !!item.interval && !isValidInterval(item.interval);
        return (
          <Draggable key={`${index}/${item.value}`} draggableId={`${index}`} index={index}>
            {(provided) => (
              <div
                className={cx(styles.row, isInvalid && styles.rowInvalid)}
                ref={provided.innerRef}
                {...provided.draggableProps}
                role="row"
              >
                <div
                  className={styles.actions}
                  role="cell"
                  aria-label={t(
                    'playlist.playlist-table-rows.aria-label-playlist-item',
                    'Playlist item, {{itemType}}, {{itemValue}}',
                    { itemType: item.type, itemValue: item.value }
                  )}
                >
                  {renderItem(item)}
                </div>
                <div className={styles.actions}>
                  <Tooltip
                    content={isInvalid ? invalidMessage : helpMessage}
                    theme={isInvalid ? 'error' : 'info'}
                    placement="top"
                  >
                    <Input
                      width={16}
                      type="text"
                      prefix={<Icon name="clock-nine" />}
                      // Controlled so each value stays with its item after a reorder.
                      value={item.interval ?? ''}
                      placeholder={
                        intervalPlaceholder
                          ? t('playlist.playlist-table-rows.interval-placeholder', 'Default ({{interval}})', {
                              interval: intervalPlaceholder,
                            })
                          : undefined
                      }
                      invalid={isInvalid}
                      suffix={isInvalid ? <Icon name="exclamation-circle" className={styles.invalidIcon} /> : undefined}
                      aria-label={t(
                        'playlist.playlist-table-rows.aria-label-item-interval',
                        'Interval for {{itemValue}}',
                        { itemValue: item.value }
                      )}
                      onChange={(e) => onUpdateInterval?.(index, e.currentTarget.value.trim())}
                    />
                  </Tooltip>
                  <div className={styles.separator} />
                  <IconButton
                    name="times"
                    size="md"
                    onClick={() => onDelete(index)}
                    data-testid={selectors.pages.PlaylistForm.itemDelete}
                    tooltip={t('playlist-edit.form.table-delete', 'Delete playlist item')}
                  />
                  <div className={styles.iconContainer} {...provided.dragHandleProps} aria-label={dragHandleLabel}>
                    <Icon title={dragHandleLabel} name="draggabledots" size="md" />
                  </div>
                </div>
              </div>
            )}
          </Draggable>
        );
      })}
    </>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      padding: theme.spacing(0.75, 1),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      // Fits the md-height input plus padding and border.
      minHeight: theme.spacing(theme.components.height.md + 2),
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '3px',

      border: `1px solid ${theme.colors.border.medium}`,
      '&:hover': {
        border: `1px solid ${theme.colors.border.strong}`,
      },
    }),
    rowInvalid: css({
      border: `1px solid ${theme.colors.error.border}`,
      '&:hover': {
        border: `1px solid ${theme.colors.error.border}`,
      },
    }),
    invalidIcon: css({
      color: theme.colors.error.text,
    }),
    iconContainer: css({
      display: 'inline-flex',
    }),
    rightMargin: css({
      marginRight: '5px',
    }),
    actions: css({
      alignItems: 'center',
      justifyContent: 'center',
      display: 'flex',
    }),
    separator: css({
      alignSelf: 'stretch',
      width: '1px',
      margin: theme.spacing(0, 1),
      background: theme.colors.border.weak,
    }),
    settings: css({
      label: 'settings',
      textAlign: 'right',
    }),
  };
}
