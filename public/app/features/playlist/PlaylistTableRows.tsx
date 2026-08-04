import { css } from '@emotion/css';
import { Draggable, type DraggableProvided } from '@hello-pangea/dnd';
import pluralize from 'pluralize';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';

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
  const [clearViewConfirmationOpen, setClearViewConfirmationOpen] = useState(false);
  const [dashboardLinkDraft, setDashboardLinkDraft] = useState('');
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
      setClearViewConfirmationOpen(false);
      setPasteLinkOpen(false);
      onUpdateQueryParams?.(index, event.data.queryParams);
      channel.close();
      window.focus();
    };
    customViewChannel.current = channel;
  };

  const closeDashboardLinkEditor = () => {
    setDashboardStateError(undefined);
    setDashboardLinkDraft('');
    setPasteLinkOpen(false);
  };

  const applyDashboardLink = async () => {
    const dashboardLink = dashboardLinkDraft.trim();
    if (!dashboardLink) {
      return;
    }

    setDashboardStateError(undefined);

    const shortLinkUid = getPlaylistShortLinkUid(dashboardLink);
    if (!shortLinkUid) {
      const dashboardState = normalizePlaylistItemQueryParams(dashboardLink);
      if (!dashboardState) {
        setDashboardStateError(
          t('playlist.playlist-table-rows.dashboard-state-empty-link', 'This link has no custom dashboard state')
        );
        return;
      }
      onUpdateQueryParams?.(index, dashboardState);
      closeDashboardLinkEditor();
      return;
    }

    setResolvingDashboardState(true);
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
      closeDashboardLinkEditor();
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
              buttonClassName={styles.settingsButton}
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
                    <div className={styles.customViewStatus}>
                      {clearViewConfirmationOpen ? (
                        <div className={styles.clearViewConfirmation}>
                          <Text variant="bodySmall">
                            <Trans i18nKey="playlist.playlist-table-rows.confirm-clear-view">Clear custom view?</Trans>
                          </Text>
                          <Button fill="text" size="md" onClick={() => setClearViewConfirmationOpen(false)}>
                            <Trans i18nKey="playlist.playlist-table-rows.cancel-clear-view">Cancel</Trans>
                          </Button>
                          <Button
                            size="md"
                            variant="destructive"
                            onClick={() => {
                              setClearViewConfirmationOpen(false);
                              setDashboardStateError(undefined);
                              setDashboardLinkDraft('');
                              setPasteLinkOpen(false);
                              onUpdateQueryParams?.(index, '');
                            }}
                          >
                            <Trans i18nKey="playlist.playlist-table-rows.confirm-clear-view-action">Clear</Trans>
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Text variant="bodySmall" color="secondary">
                            {item.queryParams ? (
                              <Tooltip
                                placement="top-start"
                                content={<CustomViewTooltipContent queryParams={item.queryParams} styles={styles} />}
                              >
                                <span className={styles.configuredStatus}>
                                  <Icon name="check-circle" size="sm" />
                                  <span className={styles.configuredStatusText}>
                                    {t('playlist.playlist-table-rows.custom-view-configured', 'Configured')}
                                  </span>
                                </span>
                              </Tooltip>
                            ) : (
                              t('playlist.playlist-table-rows.custom-view-default', 'Uses dashboard defaults')
                            )}
                          </Text>
                          {item.queryParams && (
                            <PlaylistActionIconButton
                              name="times"
                              label={t('playlist.playlist-table-rows.clear-view', 'Clear custom view')}
                              triggerClassName={styles.iconAction}
                              buttonClassName={styles.customViewIconButton}
                              onClick={() => setClearViewConfirmationOpen(true)}
                            />
                          )}
                        </>
                      )}
                    </div>
                    {!clearViewConfirmationOpen && (
                      <div className={styles.customViewActions}>
                        <LinkButton
                          size="md"
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
                        <PlaylistActionIconButton
                          name="clipboard-alt"
                          label={t('playlist.playlist-table-rows.paste-dashboard-link', 'Paste dashboard link')}
                          triggerClassName={styles.iconAction}
                          buttonClassName={styles.customViewIconButton}
                          onClick={() => {
                            setDashboardStateError(undefined);
                            setDashboardLinkDraft('');
                            setPasteLinkOpen(true);
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {pasteLinkOpen && (
                    <div className={styles.dashboardLinkEditor}>
                      <Input
                        autoFocus
                        type="text"
                        value={dashboardLinkDraft}
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
                        onChange={(event) => {
                          setDashboardStateError(undefined);
                          setDashboardLinkDraft(event.currentTarget.value);
                        }}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void applyDashboardLink();
                          }
                        }}
                      />
                      <Button
                        size="md"
                        variant="secondary"
                        disabled={resolvingDashboardState}
                        onClick={closeDashboardLinkEditor}
                      >
                        <Trans i18nKey="playlist.playlist-table-rows.cancel-dashboard-link">Cancel</Trans>
                      </Button>
                      <Button
                        size="md"
                        disabled={!dashboardLinkDraft.trim() || resolvingDashboardState}
                        onClick={applyDashboardLink}
                      >
                        <Trans i18nKey="playlist.playlist-table-rows.apply-dashboard-link">Apply</Trans>
                      </Button>
                    </div>
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

interface CustomViewTooltipContentProps {
  queryParams: string;
  styles: ReturnType<typeof getStyles>;
}

function CustomViewTooltipContent({ queryParams, styles }: CustomViewTooltipContentProps) {
  const params = new URLSearchParams(queryParams);
  const from = params.get('from');
  const to = params.get('to');
  const variables = new Map<string, string[]>();
  const options: Array<[string, string]> = [];

  params.forEach((value, key) => {
    if (key.startsWith('var-')) {
      const name = key.slice(4);
      variables.set(name, [...(variables.get(name) ?? []), value]);
    } else if (key !== 'from' && key !== 'to') {
      options.push([key, value]);
    }
  });

  return (
    <div className={styles.customViewTooltip}>
      <Text variant="bodySmall" weight="medium">
        <Trans i18nKey="playlist.playlist-table-rows.custom-view-tooltip-title">Custom view options</Trans>
      </Text>
      {from && to && (
        <CustomViewTooltipRow
          label={t('playlist.playlist-table-rows.custom-view-time-range', 'Time range')}
          value={`${from} → ${to}`}
          styles={styles}
        />
      )}
      {[...variables].map(([name, values]) => (
        <CustomViewTooltipRow
          key={`variable-${name}`}
          label={t('playlist.playlist-table-rows.custom-view-variable', 'Variable: {{name}}', { name })}
          value={values.join(', ')}
          styles={styles}
        />
      ))}
      {options.map(([name, value], index) => (
        <CustomViewTooltipRow key={`option-${name}-${index}`} label={name} value={value} styles={styles} />
      ))}
    </div>
  );
}

interface CustomViewTooltipRowProps {
  label: string;
  value: string;
  styles: ReturnType<typeof getStyles>;
}

function CustomViewTooltipRow({ label, value, styles }: CustomViewTooltipRowProps) {
  return (
    <div className={styles.customViewTooltipRow}>
      <span className={styles.customViewTooltipLabel}>{label}</span>
      <span>{value}</span>
    </div>
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
      marginRight: theme.spacing(0.5),
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
    settingsButton: css({
      '& svg': {
        transform: 'translateY(1px)',
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
      display: 'grid',
      gap: theme.spacing(0.5),
    }),
    customViewControls: css({
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5, 1.5),
      justifyContent: 'flex-start',
      // Match the neighboring Interval input's 32px control box while keeping
      // the compact actions themselves at their native 24px height.
      minHeight: theme.spacing(4),
    }),
    customViewActions: css({
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      minHeight: theme.spacing(4),
    }),
    customViewStatus: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(0.5),
      minHeight: theme.spacing(4),
      transform: 'translateY(1px)',
    }),
    customViewIconButton: css({
      height: theme.spacing(4),
      margin: 0,
      width: theme.spacing(4),
    }),
    clearViewConfirmation: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    configuredStatus: css({
      alignItems: 'center',
      cursor: 'help',
      display: 'inline-flex',
      gap: theme.spacing(0.5),
      transform: 'translateY(1px)',
    }),
    configuredStatusText: css({
      borderBottom: `1px dotted ${theme.colors.text.secondary}`,
    }),
    dashboardLinkEditor: css({
      alignItems: 'center',
      display: 'grid',
      gap: theme.spacing(0.5),
      gridTemplateColumns: 'minmax(0, 1fr) auto auto',
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
      },
    }),
    customViewTooltip: css({
      display: 'grid',
      gap: theme.spacing(0.5),
      minWidth: 220,
      padding: theme.spacing(0.5),
    }),
    customViewTooltipRow: css({
      display: 'grid',
      gap: theme.spacing(1),
      gridTemplateColumns: 'minmax(88px, auto) minmax(0, 1fr)',
    }),
    customViewTooltipLabel: css({
      color: theme.colors.text.secondary,
    }),
    options: css({
      display: 'grid',
      gridColumn: '1 / -1',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(88px, 120px)',
      gap: theme.spacing(2),
      marginTop: theme.spacing(1.5),
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: 'minmax(0, 1fr)',
      },
    }),
  };
}
