// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css, cx } from '@emotion/css';
import { memo, useEffect, useMemo, useState } from 'react';
import * as React from 'react';

import {
  CoreApp,
  TraceSearchProps,
  DataFrame,
  dateTimeFormat,
  dateTimeFormatTimeAgo,
  GrafanaTheme2,
  PluginExtensionPoints,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction, renderLimitedComponents, usePluginComponents, usePluginLinks } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import {
  Badge,
  BadgeColor,
  Button,
  ButtonGroup,
  Dropdown,
  Icon,
  LinkButton,
  Menu,
  Tooltip,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { config } from '../../../../../core/config';
import { downloadTraceAsJson } from '../../../../inspector/utils/download';
import { getHeaderTags, getTraceName } from '../model/trace-viewer';
import { Trace, TraceViewPluginExtensionContext } from '../types/trace';
import { formatDuration } from '../utils/date';

import { SpanFilters } from './SpanFilters/SpanFilters';

export type TracePageHeaderProps = {
  trace: Trace | null;
  data: DataFrame;
  app?: CoreApp;
  timeZone: TimeZone;
  search: TraceSearchProps;
  setSearch: (newSearch: TraceSearchProps) => void;
  showSpanFilters: boolean;
  setShowSpanFilters: (isOpen: boolean) => void;
  setFocusedSpanIdForSearch: React.Dispatch<React.SetStateAction<string>>;
  spanFilterMatches: Set<string> | undefined;
  datasourceType: string;
  datasourceName: string;
  datasourceUid: string;
  setHeaderHeight: (height: number) => void;
};

export const TracePageHeader = memo((props: TracePageHeaderProps) => {
  const {
    trace,
    data,
    app,
    timeZone,
    search,
    setSearch,
    showSpanFilters,
    setShowSpanFilters,
    setFocusedSpanIdForSearch,
    spanFilterMatches,
    datasourceType,
    datasourceName,
    datasourceUid,
    setHeaderHeight,
  } = props;

  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const notifyApp = useAppNotification();
  const [copyTraceIdClicked, setCopyTraceIdClicked] = useState(false);

  useEffect(() => {
    setHeaderHeight(document.querySelector('.' + styles.header)?.scrollHeight ?? 0);
  }, [setHeaderHeight, showSpanFilters, styles.header]);

  // Build context for plugin extensions if trace is available
  const traceContext: TraceViewPluginExtensionContext | undefined = trace
    ? {
        ...trace,
        datasource: {
          name: datasourceName,
          uid: datasourceUid,
          type: datasourceType,
        },
      }
    : undefined;

  const { links: extensionLinks } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.TraceViewHeaderActions,
    context: traceContext,
    limitPerPlugin: 2,
  });

  const { components: extensionComponents } = usePluginComponents<TraceViewPluginExtensionContext>({
    extensionPointId: PluginExtensionPoints.TraceViewHeaderActions,
  });

  if (!trace) {
    return null;
  }

  const { method, status, url } = getHeaderTags(trace.spans);
  const traceName = getTraceName(trace.spans);

  // Convert date from micro to milli seconds
  const formattedTimestamp = dateTimeFormat(trace.startTime / 1000, { timeZone, defaultWithMS: true });

  // Memoize service count to avoid recomputing on every render
  const serviceCount = useMemo(() => {
    return new Set(trace.spans.map((span) => span.process?.serviceName)).size;
  }, [trace.spans]);

  let statusColor: BadgeColor = 'green';
  if (status && status.length > 0) {
    if (status[0].value.toString().charAt(0) === '4') {
      statusColor = 'orange';
    } else if (status[0].value.toString().charAt(0) === '5') {
      statusColor = 'red';
    }
  }

  const copyTraceId = () => {
    navigator.clipboard.writeText(trace.traceID);
    setCopyTraceIdClicked(true);
    setTimeout(() => {
      setCopyTraceIdClicked(false);
    }, 5000);
  };

  const exportTrace = () => {
    const traceFormat = downloadTraceAsJson(data, 'Trace-' + trace.traceID.substring(trace.traceID.length - 6));
    reportInteraction('grafana_traces_download_traces_clicked', {
      app,
      grafana_version: config.buildInfo.version,
      trace_format: traceFormat,
      location: 'trace-view',
    });
  };

  const shareDropdownMenu = (
    <Menu>
      <Menu.Item
        label={t('explore.trace-page-header.share-copy-link', 'Copy link')}
        icon="link"
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
          notifyApp.success(t('explore.trace-page-header.link-copied', 'Link copied to clipboard'));
        }}
      />
      <Menu.Item
        label={t('explore.trace-page-header.share-export-json', 'Export as JSON')}
        icon="download-alt"
        onClick={() => {
          exportTrace();
          notifyApp.success(t('explore.trace-page-header.export-started', 'Export started'));
        }}
      />
    </Menu>
  );

  return (
    <header className={styles.header}>
      {/* Main title row */}
      <div className={styles.titleRow}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>{traceName}</h1>
          <div className={styles.badges}>
            {method && method.length > 0 && <Badge text={method[0].value} color="blue" />}
            {status && status.length > 0 && <Badge text={status[0].value} color={statusColor} />}
          </div>
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          {/* Plugin extension actions */}
          {extensionLinks.length > 0 && (
            <div className={styles.actions}>
              {extensionLinks.map((link) => (
                <Tooltip key={link.id} content={link.description || link.title}>
                  <Button
                    size="sm"
                    variant="primary"
                    fill="outline"
                    icon={link.icon}
                    onClick={(event) => {
                      if (link.path) {
                        window.open(link.path, '_blank');
                      }
                      link.onClick?.(event);
                    }}
                  >
                    {link.title}
                  </Button>
                </Tooltip>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            {traceContext
              ? renderLimitedComponents<TraceViewPluginExtensionContext>({
                  props: traceContext,
                  components: extensionComponents,
                  limit: 2,
                })
              : null}
          </div>

          {config.feedbackLinksEnabled && (
            <Tooltip
              content={t(
                'explore.trace-page-header.title-share-thoughts-about-tracing-grafana',
                'Share your thoughts about tracing in Grafana.'
              )}
            >
              <LinkButton
                size="sm"
                variant="secondary"
                fill="outline"
                icon="comment-alt-message"
                href="https://forms.gle/RZDEx8ScyZNguDoC8"
                target="_blank"
              >
                <Trans i18nKey="explore.trace-page-header.give-feedback">Feedback</Trans>
              </LinkButton>
            </Tooltip>
          )}

          <ButtonGroup>
            <Tooltip content={t('explore.trace-page-header.share-tooltip', 'Share trace')}>
              <Button
                size="sm"
                variant="secondary"
                fill="outline"
                icon="share-alt"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  notifyApp.success(t('explore.trace-page-header.link-copied', 'Link copied to clipboard'));
                }}
              >
                {t('explore.trace-page-header.share', 'Share')}
              </Button>
            </Tooltip>

            <Dropdown overlay={shareDropdownMenu} placement="bottom-end">
              <Button
                aria-label={t('explore.trace-page-header.aria-label-share-dropdown', 'Open share trace options menu')}
                size="sm"
                variant="secondary"
                fill="outline"
                icon="angle-down"
              />
            </Dropdown>
          </ButtonGroup>
        </div>
      </div>

      {/* Metadata row */}
      <div className={styles.metadataRow}>
        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>{t('explore.trace-page-header.trace-id', 'Trace ID')}</span>
          <span className={styles.metadataValue}>
            <button className={styles.traceIdButton} onClick={copyTraceId}>
              {trace.traceID}
              <Icon name={copyTraceIdClicked ? 'check' : 'copy'} size="sm" className={styles.copyIcon} />
            </button>
          </span>
        </div>

        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>{t('explore.trace-page-header.start-time', 'Start time')}</span>
          <span
            className={cx(
              styles.metadataValue,
              css({
                gap: theme.spacing(0.5),
              })
            )}
          >
            <span>{formattedTimestamp}</span>
            <span className={styles.timestampDetail}>({dateTimeFormatTimeAgo(trace.startTime / 1000)})</span>
          </span>
        </div>

        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>{t('explore.trace-page-header.duration', 'Duration')}</span>
          <span className={styles.metadataValue}>{formatDuration(trace.duration)}</span>
        </div>

        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>{t('explore.trace-page-header.services', 'Services')}</span>
          <span className={styles.metadataValue}>{serviceCount}</span>
        </div>

        {url && url.length > 0 && (
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>
              {url[0].key === 'http.route' && t('explore.trace-page-header.route', 'Route')}
              {url[0].key === 'http.url' && t('explore.trace-page-header.url', 'URL')}
              {url[0].key === 'http.target' && t('explore.trace-page-header.target', 'Target')}
              {url[0].key === 'http.path' && t('explore.trace-page-header.path', 'Path')}
            </span>
            <span className={styles.metadataValue}>
              <Tooltip
                content={
                  <div>
                    <div>
                      <Trans
                        i18nKey="explore.trace-page-header.tooltip-url"
                        values={{
                          route: 'http.route',
                          url: 'http.url',
                          target: 'http.target',
                          path: 'http.path',
                        }}
                      >
                        {'{{route}}'} or {'{{url}}'} or {'{{target}}'} or {'{{path}}'}
                      </Trans>
                    </div>
                    <div>({url[0].value})</div>
                  </div>
                }
                interactive={true}
              >
                <span className={styles.url}>{url[0].value}</span>
              </Tooltip>
            </span>
          </div>
        )}
      </div>

      <SpanFilters
        trace={trace}
        showSpanFilters={showSpanFilters}
        setShowSpanFilters={setShowSpanFilters}
        search={search}
        setSearch={setSearch}
        spanFilterMatches={spanFilterMatches}
        setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
        datasourceType={datasourceType}
      />
    </header>
  );
});

TracePageHeader.displayName = 'TracePageHeader';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      label: 'TracePageHeader',
      backgroundColor: theme.colors.background.primary,
      padding: '0.5em',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      textAlign: 'left',
    }),

    titleRow: css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(1),
      gap: theme.spacing(2),
    }),

    titleSection: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      flex: 1,
      minWidth: 0, // Allow text truncation
    }),

    title: css({
      color: theme.colors.text.primary,
      fontSize: theme.typography.h3.fontSize,
      fontWeight: theme.typography.h3.fontWeight,
      lineHeight: theme.typography.h3.lineHeight,
      margin: 0,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),

    badges: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      flexShrink: 0,
    }),

    actions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexShrink: 0,
    }),

    metadataRow: css({
      display: 'flex',
      alignItems: 'center',
      columnGap: theme.spacing(3),
      marginBottom: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      flexWrap: 'wrap',
    }),

    metadataItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),

    metadataLabel: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),

    metadataValue: css({
      color: theme.colors.text.primary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),

    traceIdButton: css({
      background: 'none',
      border: 'none',
      color: theme.colors.text.primary,
      cursor: 'pointer',
      textDecoration: 'underline',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: 0,
      font: 'inherit',

      '&:hover': {
        color: theme.colors.emphasize(theme.colors.text.primary, 0.15),
      },
    }),

    copyIcon: css({
      opacity: 0.7,
    }),

    copiedText: css({
      color: theme.colors.success.text,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),

    timestampDetail: css({
      color: theme.colors.text.disabled,
    }),

    url: css({
      maxWidth: '700px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'inline-block',
      color: theme.colors.text.primary,
    }),
  };
};
