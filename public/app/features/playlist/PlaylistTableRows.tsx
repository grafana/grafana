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
  TextLink,
  Tooltip,
  useStyles2,
  type IconButtonVariant,
  type IconName,
} from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

import {
  addPlaylistCustomViewContext,
  createPlaylistCustomViewToken,
  getPlaylistCustomViewChannelName,
  isPlaylistCustomViewMessage,
} from './customView';
import { type PlaylistItemUI } from './types';
import { getPlaylistShortLinkUid, isValidInterval, normalizeDashboardViewQueryString } from './utils';

interface Props {
  items: PlaylistItemUI[];
  playlistTitle?: string;
  onDelete: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  /** Placeholder for empty per-item intervals; the global interval used as fallback during playback. */
  intervalPlaceholder?: string;
  onUpdateInterval?: (idx: number, interval: string) => void;
  onUpdateDashboardView?: (idx: number, queryString: string) => void;
}

export const PlaylistTableRows = ({
  items,
  playlistTitle,
  onDelete,
  onDuplicate,
  intervalPlaceholder,
  onUpdateInterval,
  onUpdateDashboardView,
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
          <span key="info" className={styles.dashboardTitle}>
            <TextLink href={getDashboardUrl(item) ?? first.url} external inline={false}>
              <Text element="p" truncate>
                {first.name ?? item.value}
              </Text>
            </TextLink>
          </span>
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
          key={item.localId ?? `${index}/${item.type}/${item.value}`}
          item={item}
          index={index}
          playlistTitle={playlistTitle}
          styles={styles}
          renderItem={renderItem}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          intervalPlaceholder={intervalPlaceholder}
          onUpdateInterval={onUpdateInterval}
          onUpdateDashboardView={onUpdateDashboardView}
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
  playlistTitle,
  styles,
  renderItem,
  onDelete,
  onDuplicate,
  intervalPlaceholder,
  onUpdateInterval,
  onUpdateDashboardView,
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
  const currentIndex = useRef(index);
  const mounted = useRef(true);
  currentIndex.current = index;
  const optionsId = useId();
  const dashboardLinkEditorId = useId();
  const optionSummary = [
    item.dashboardView ? t('playlist.playlist-table-rows.dashboard-state-summary', 'Custom view') : undefined,
    item.interval
      ? t('playlist.playlist-table-rows.interval-summary', 'Interval: {{interval}}', { interval: item.interval })
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  const dashboardUrl = getDashboardUrl(item);
  const intervalInvalid = !!item.interval && !isValidInterval(item.interval);
  const intervalError = intervalInvalid
    ? t('playlist.playlist-table-rows.invalid-interval-error', 'Invalid interval')
    : undefined;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      customViewChannel.current?.close();
    };
  }, []);

  const configureCustomViewUrl = dashboardUrl
    ? addPlaylistCustomViewContext(dashboardUrl, customViewToken, playlistTitle)
    : undefined;
  const beginCustomViewConfiguration = () => {
    customViewChannel.current?.close();
    const channel = new BroadcastChannel(getPlaylistCustomViewChannelName(customViewToken));
    channel.onmessage = (event) => {
      if (!mounted.current || !isPlaylistCustomViewMessage(event.data) || event.data.token !== customViewToken) {
        return;
      }

      setDashboardStateError(undefined);
      setClearViewConfirmationOpen(false);
      setPasteLinkOpen(false);
      onUpdateDashboardView?.(currentIndex.current, normalizeDashboardViewQueryString(event.data.queryString) ?? '');
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
      const dashboardState = normalizeDashboardViewQueryString(dashboardLink);
      if (!dashboardState) {
        setDashboardStateError(
          t('playlist.playlist-table-rows.dashboard-state-empty-link', 'This link has no custom dashboard state')
        );
        return;
      }
      onUpdateDashboardView?.(currentIndex.current, dashboardState);
      closeDashboardLinkEditor();
      return;
    }

    setResolvingDashboardState(true);
    try {
      const shortLink = await getBackendSrv().get<{ path: string }>(
        `/api/short-urls/${encodeURIComponent(shortLinkUid)}`
      );
      if (!mounted.current) {
        return;
      }
      const dashboardState = normalizeDashboardViewQueryString(shortLink.path);
      if (!dashboardState) {
        setDashboardStateError(
          t('playlist.playlist-table-rows.dashboard-state-empty-link', 'This link has no custom dashboard state')
        );
        return;
      }
      onUpdateDashboardView?.(currentIndex.current, dashboardState);
      closeDashboardLinkEditor();
    } catch {
      if (mounted.current) {
        setDashboardStateError(
          t(
            'playlist.playlist-table-rows.dashboard-state-short-link-error',
            'Could not resolve this short link. Paste the full dashboard URL instead.'
          )
        );
      }
    } finally {
      if (mounted.current) {
        setResolvingDashboardState(false);
      }
    }
  };

  return (
    <Draggable draggableId={item.localId ?? `${index}/${item.type}/${item.value}`} index={index}>
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
              <span className={styles.optionSummary} title={optionSummary}>
                <Text variant="bodySmall" color="secondary">
                  {optionSummary}
                </Text>
              </span>
            )}
            <PlaylistActionIconButton
              name="copy"
              label={t('playlist.playlist-table-rows.duplicate-item', 'Duplicate playlist item')}
              tooltip={t('playlist.playlist-table-rows.duplicate-item-tooltip', 'Duplicate')}
              triggerClassName={styles.iconAction}
              buttonClassName={styles.duplicateButton}
              onClick={() => onDuplicate(index)}
            />
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
                  tooltip={t('playlist.playlist-table-rows.delete-item-tooltip', 'Delete')}
                  variant="destructive"
                  buttonClassName={styles.deleteButton}
                  testId={selectors.pages.PlaylistForm.itemDelete}
                  triggerClassName={styles.iconAction}
                  onClick={() => setDeleteConfirmationOpen(true)}
                />
              )}
            </div>
            <div {...provided.dragHandleProps}>
              <Icon
                title={t('playlist-edit.form.table-drag', 'Reorder playlist item')}
                name="draggabledots"
                size="md"
              />
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
                              onUpdateDashboardView?.(currentIndex.current, '');
                            }}
                          >
                            <Trans i18nKey="playlist.playlist-table-rows.confirm-clear-view-action">Clear</Trans>
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Text variant="bodySmall" color="secondary">
                            {item.dashboardView ? (
                              <Tooltip
                                placement="top-start"
                                content={
                                  <CustomViewTooltipContent
                                    queryString={item.dashboardView.queryString}
                                    styles={styles}
                                  />
                                }
                              >
                                <button
                                  type="button"
                                  className={styles.configuredStatus}
                                  aria-label={t(
                                    'playlist.playlist-table-rows.show-custom-view-options',
                                    'Show custom view options'
                                  )}
                                >
                                  <Icon name="check-circle" size="sm" />
                                  <span className={styles.configuredStatusText}>
                                    {t('playlist.playlist-table-rows.custom-view-configured', 'Configured')}
                                  </span>
                                </button>
                              </Tooltip>
                            ) : (
                              t('playlist.playlist-table-rows.custom-view-default', 'Uses dashboard defaults')
                            )}
                          </Text>
                          {item.dashboardView && (
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
                          label={
                            pasteLinkOpen
                              ? t(
                                  'playlist.playlist-table-rows.cancel-pasting-dashboard-link',
                                  'Cancel pasting dashboard link'
                                )
                              : t('playlist.playlist-table-rows.paste-dashboard-link', 'Paste a link to this dashboard')
                          }
                          tooltip={
                            pasteLinkOpen
                              ? t('playlist.playlist-table-rows.cancel-dashboard-link', 'Cancel')
                              : t(
                                  'playlist.playlist-table-rows.dashboard-link-help',
                                  'Paste a link to this dashboard with the view you want'
                                )
                          }
                          variant={pasteLinkOpen ? 'primary' : 'secondary'}
                          expanded={pasteLinkOpen}
                          controls={dashboardLinkEditorId}
                          triggerClassName={styles.iconAction}
                          buttonClassName={styles.customViewIconButton}
                          onClick={() => {
                            if (pasteLinkOpen) {
                              closeDashboardLinkEditor();
                              return;
                            }
                            setDashboardStateError(undefined);
                            setDashboardLinkDraft('');
                            setPasteLinkOpen(true);
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {pasteLinkOpen && (
                    <div id={dashboardLinkEditorId} className={styles.dashboardLinkEditor}>
                      <Input
                        autoFocus
                        type="text"
                        value={dashboardLinkDraft}
                        placeholder={t(
                          'playlist.playlist-table-rows.dashboard-state-placeholder',
                          'Paste dashboard link'
                        )}
                        title={t(
                          'playlist.playlist-table-rows.dashboard-state-title',
                          'Paste a link to this dashboard or enter its URL state'
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
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            closeDashboardLinkEditor();
                            return;
                          }
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
              <Field
                noMargin
                label={t('playlist.playlist-table-rows.interval-addon', 'Interval')}
                invalid={!!intervalError}
                error={intervalError}
              >
                <Input
                  type="text"
                  // Controlled so the value always reflects the correct item after a
                  // reorder and stays synced for submission/validation on every keystroke.
                  value={item.interval ?? ''}
                  placeholder={intervalPlaceholder}
                  invalid={!!intervalError}
                  title={intervalError}
                  aria-label={t('playlist.playlist-table-rows.aria-label-item-interval', 'Interval for {{itemValue}}', {
                    itemValue: item.value,
                  })}
                  onChange={(e) => onUpdateInterval?.(currentIndex.current, e.currentTarget.value.trim())}
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
  queryString: string;
  styles: ReturnType<typeof getStyles>;
}

function CustomViewTooltipContent({ queryString, styles }: CustomViewTooltipContentProps) {
  const params = new URLSearchParams(queryString);
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
      {(from || to) && (
        <CustomViewTooltipRow
          label={t('playlist.playlist-table-rows.custom-view-time-range', 'Time range')}
          value={`${from ?? t('playlist.playlist-table-rows.custom-view-default-time', 'Dashboard default')} → ${
            to ?? t('playlist.playlist-table-rows.custom-view-default-time', 'Dashboard default')
          }`}
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

function getDashboardUrl(item: PlaylistItemUI): string | undefined {
  const dashboard = item.dashboards?.length === 1 ? item.dashboards[0] : undefined;
  if (!dashboard) {
    return undefined;
  }

  return urlUtil.renderUrl(dashboard.url.split('?')[0], {
    ...urlUtil.parseKeyValue(dashboard.url.split('?')[1] ?? ''),
    ...urlUtil.parseKeyValue(normalizeDashboardViewQueryString(item.dashboardView?.queryString) ?? ''),
  });
}

interface PlaylistActionIconButtonProps {
  name: IconName;
  label: string;
  tooltip?: string;
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
  tooltip,
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
      <Tooltip content={tooltip ?? label} placement="top" show={tooltipOpen}>
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
    dashboardTitle: css({
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      '& > a': {
        alignItems: 'baseline',
        display: 'flex',
        maxWidth: '100%',
        width: 'fit-content',
      },
      '& p': {
        minWidth: 0,
      },
      '& svg': {
        flexShrink: 0,
        transform: 'translateY(1px)',
        [theme.breakpoints.down('md')]: {
          display: 'none',
        },
      },
    }),
    rowActions: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    optionSummary: css({
      display: 'inline-block',
      marginRight: theme.spacing(0.5),
      maxWidth: 'min(240px, 40vw)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      transform: 'translateY(1px)',
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
    duplicateButton: css({
      '& svg': {
        transform: 'translateY(1px)',
      },
    }),
    deleteAction: css({
      alignItems: 'center',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      minHeight: theme.spacing(3),
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
      gap: theme.spacing(0.5),
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
      background: 'transparent',
      border: 0,
      color: 'inherit',
      cursor: 'help',
      display: 'inline-flex',
      font: 'inherit',
      gap: theme.spacing(0.5),
      padding: 0,
      transform: 'translateY(1px)',
      '&:focus-visible': {
        borderRadius: theme.shape.radius.default,
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: 2,
      },
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
