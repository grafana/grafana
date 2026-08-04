import { css } from '@emotion/css';
import { Draggable, type DraggableProvided } from '@hello-pangea/dnd';
import pluralize from 'pluralize';
import { type ClipboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { type GrafanaTheme2, urlUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import {
  Button,
  Field,
  Icon,
  IconButton,
  Input,
  LinkButton,
  Spinner,
  Text,
  Tooltip,
  useStyles2,
  type IconButtonVariant,
  type IconName,
} from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

import {
  addPlaylistCustomViewToken,
  createPlaylistCustomViewToken,
  getPlaylistCustomViewChannelName,
  isPlaylistCustomViewMessage,
} from './customView';
import { type PlaylistItemUI } from './types';
import { getPlaylistShortLinkUid, isValidInterval, normalizePlaylistItemQueryParams } from './utils';

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
  const [dashboardStateError, setDashboardStateError] = useState<string>();
  const [resolvingDashboardState, setResolvingDashboardState] = useState(false);
  const [pasteLinkOpen, setPasteLinkOpen] = useState(false);
  const [customViewToken] = useState(createPlaylistCustomViewToken);
  const customViewChannel = useRef<BroadcastChannel>();
  const optionsId = useId();
  const optionSummary = [
    item.queryParams ? t('playlist.playlist-table-rows.dashboard-state-summary', 'Custom view') : undefined,
    item.interval
      ? t('playlist.playlist-table-rows.interval-summary', 'Interval: {{interval}}', { interval: item.interval })
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  const dashboard = item.dashboards?.length === 1 ? item.dashboards[0] : undefined;
  const dashboardUrl = dashboard
    ? urlUtil.renderUrl(dashboard.url.split('?')[0], {
        ...urlUtil.parseKeyValue(dashboard.url.split('?')[1] ?? ''),
        ...urlUtil.parseKeyValue(normalizePlaylistItemQueryParams(item.queryParams) ?? ''),
      })
    : undefined;

  useEffect(() => () => customViewChannel.current?.close(), []);

  const configureCustomViewUrl = dashboardUrl ? addPlaylistCustomViewToken(dashboardUrl, customViewToken) : undefined;
  const beginCustomViewConfiguration = () => {
    customViewChannel.current?.close();
    const channel = new BroadcastChannel(getPlaylistCustomViewChannelName(customViewToken));
    channel.onmessage = (event) => {
      if (!isPlaylistCustomViewMessage(event.data) || event.data.token !== customViewToken) {
        return;
      }

      setDashboardStateError(undefined);
      setPasteLinkOpen(false);
      onUpdateQueryParams?.(index, event.data.queryParams);
      channel.close();
      window.focus();
    };
    customViewChannel.current = channel;
  };

  const onDashboardStatePaste = async (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = event.clipboardData.getData('text').trim();
    if (!pastedValue) {
      return;
    }

    event.preventDefault();
    setDashboardStateError(undefined);

    const shortLinkUid = getPlaylistShortLinkUid(pastedValue);
    if (!shortLinkUid) {
      onUpdateQueryParams?.(index, normalizePlaylistItemQueryParams(pastedValue) ?? '');
      setPasteLinkOpen(false);
      return;
    }

    setResolvingDashboardState(true);
    onUpdateQueryParams?.(index, '');
    try {
      const shortLink = await getBackendSrv().get<{ path: string }>(
        `/api/short-urls/${encodeURIComponent(shortLinkUid)}`
      );
      const dashboardState = normalizePlaylistItemQueryParams(shortLink.path);
      if (!dashboardState) {
        setDashboardStateError(
          t('playlist.playlist-table-rows.dashboard-state-empty-link', 'This link has no custom dashboard state')
        );
        return;
      }
      onUpdateQueryParams?.(index, dashboardState);
      setPasteLinkOpen(false);
    } catch {
      setDashboardStateError(
        t(
          'playlist.playlist-table-rows.dashboard-state-short-link-error',
          'Could not resolve this short link. Paste the full dashboard URL instead.'
        )
      );
    } finally {
      setResolvingDashboardState(false);
    }
  };

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
            <PlaylistActionIconButton
              name="cog"
              label={t('playlist.playlist-table-rows.settings', 'Settings')}
              variant={optionsOpen ? 'primary' : 'secondary'}
              expanded={optionsOpen}
              controls={optionsId}
              triggerClassName={styles.iconAction}
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
                <PlaylistActionIconButton
                  name="trash-alt"
                  label={t('playlist-edit.form.table-delete', 'Delete playlist item')}
                  variant="destructive"
                  buttonClassName={styles.deleteButton}
                  testId={selectors.pages.PlaylistForm.itemDelete}
                  triggerClassName={styles.iconAction}
                  onClick={() => setDeleteConfirmationOpen(true)}
                />
              )}
            </div>
          </div>
          {optionsOpen && (
            <div className={styles.options} id={optionsId}>
              <Field
                noMargin
                label={t('playlist.playlist-table-rows.custom-view-label', 'Custom view')}
                invalid={!!dashboardStateError}
                error={dashboardStateError}
                loading={resolvingDashboardState}
              >
                <div className={styles.customViewEditor}>
                  <div className={styles.customViewControls}>
                    <Text variant="bodySmall" color="secondary">
                      {item.queryParams
                        ? t('playlist.playlist-table-rows.custom-view-configured', 'Configured')
                        : t('playlist.playlist-table-rows.custom-view-default', 'Uses dashboard defaults')}
                    </Text>
                    <div className={styles.customViewActions}>
                      <LinkButton
                        size="sm"
                        variant="secondary"
                        icon="sliders-v-alt"
                        href={configureCustomViewUrl ?? ''}
                        target="_blank"
                        rel="noreferrer"
                        disabled={!configureCustomViewUrl}
                        onClick={beginCustomViewConfiguration}
                      >
                        <Trans i18nKey="playlist.playlist-table-rows.configure-view">Configure</Trans>
                      </LinkButton>
                      <Button
                        size="sm"
                        fill="text"
                        icon="clipboard-alt"
                        onClick={() => setPasteLinkOpen((open) => !open)}
                      >
                        <Trans i18nKey="playlist.playlist-table-rows.paste-dashboard-link">Paste link</Trans>
                      </Button>
                      {item.queryParams && (
                        <Button
                          size="sm"
                          fill="text"
                          onClick={() => {
                            setDashboardStateError(undefined);
                            setPasteLinkOpen(false);
                            onUpdateQueryParams?.(index, '');
                          }}
                        >
                          <Trans i18nKey="playlist.playlist-table-rows.clear-view">Clear</Trans>
                        </Button>
                      )}
                    </div>
                  </div>
                  {pasteLinkOpen && (
                    <Input
                      autoFocus
                      type="text"
                      value={item.queryParams ?? ''}
                      placeholder={t(
                        'playlist.playlist-table-rows.dashboard-state-placeholder',
                        'Paste a dashboard link'
                      )}
                      title={t(
                        'playlist.playlist-table-rows.dashboard-state-title',
                        'Paste a dashboard link or enter its URL state'
                      )}
                      aria-label={t(
                        'playlist.playlist-table-rows.aria-label-item-dashboard-state',
                        'Dashboard state for {{itemValue}}',
                        { itemValue: item.value }
                      )}
                      loading={resolvingDashboardState}
                      onPaste={onDashboardStatePaste}
                      onChange={(e) => {
                        setDashboardStateError(undefined);
                        onUpdateQueryParams?.(index, e.currentTarget.value);
                      }}
                    />
                  )}
                </div>
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

interface PlaylistActionIconButtonProps {
  name: IconName;
  label: string;
  onClick: () => void;
  triggerClassName: string;
  buttonClassName?: string;
  variant?: IconButtonVariant;
  expanded?: boolean;
  controls?: string;
  testId?: string;
}

function PlaylistActionIconButton({
  name,
  label,
  onClick,
  triggerClassName,
  buttonClassName,
  variant,
  expanded,
  controls,
  testId,
}: PlaylistActionIconButtonProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div
      className={triggerClassName}
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
      onFocusCapture={() => setTooltipOpen(true)}
      onBlurCapture={() => setTooltipOpen(false)}
    >
      <Tooltip content={label} placement="top" show={tooltipOpen}>
        <IconButton
          name={name}
          size="md"
          variant={variant}
          className={buttonClassName}
          aria-label={label}
          aria-expanded={expanded}
          aria-controls={controls}
          data-testid={testId}
          onClick={() => {
            setTooltipOpen(false);
            onClick();
          }}
        />
      </Tooltip>
    </div>
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
    iconAction: css({
      alignItems: 'center',
      display: 'flex',
      '& svg': {
        // Keep the button as one uninterrupted tooltip trigger when the pointer
        // moves from its hit area onto the decorative icon.
        pointerEvents: 'none',
      },
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
    customViewEditor: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      display: 'grid',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.5, 1),
    }),
    customViewControls: css({
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5, 1),
      justifyContent: 'space-between',
      minHeight: theme.spacing(3),
    }),
    customViewActions: css({
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
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
