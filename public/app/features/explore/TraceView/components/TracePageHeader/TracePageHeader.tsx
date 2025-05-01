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

import { css } from '@emotion/css';
import cx from 'classnames';
import { memo, useEffect, useMemo } from 'react';
import * as React from 'react';

import { CoreApp, DataFrame, dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { Badge, BadgeColor, Tooltip, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { SearchProps } from '../../useSearch';
import ExternalLinks from '../common/ExternalLinks';
import TraceName from '../common/TraceName';
import { getTraceLinks } from '../model/link-patterns';
import { getHeaderTags, getTraceName } from '../model/trace-viewer';
import { Trace } from '../types';
import { formatDuration } from '../utils/date';

import TracePageActions from './Actions/TracePageActions';
import { SpanFilters } from './SpanFilters/SpanFilters';

export type TracePageHeaderProps = {
  trace: Trace | null;
  data: DataFrame;
  app?: CoreApp;
  timeZone: TimeZone;
  search: SearchProps;
  setSearch: React.Dispatch<React.SetStateAction<SearchProps>>;
  showSpanFilters: boolean;
  setShowSpanFilters: (isOpen: boolean) => void;
  setFocusedSpanIdForSearch: React.Dispatch<React.SetStateAction<string>>;
  spanFilterMatches: Set<string> | undefined;
  datasourceType: string;
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
    setHeaderHeight,
  } = props;
  const styles = useStyles2(getNewStyles);

  useEffect(() => {
    setHeaderHeight(document.querySelector('.' + styles.header)?.scrollHeight ?? 0);
  }, [setHeaderHeight, showSpanFilters, styles.header]);

  const links = useMemo(() => {
    if (!trace) {
      return [];
    }
    return getTraceLinks(trace);
  }, [trace]);

  if (!trace) {
    return null;
  }

  const timestamp = (trace: Trace, timeZone: TimeZone) => {
    // Convert date from micro to milli seconds
    const dateStr = dateTimeFormat(trace.startTime / 1000, { timeZone, defaultWithMS: true });
    const match = dateStr.match(/^(.+)(:\d\d\.\d+)$/);
    return match ? (
      <span className={styles.TracePageHeaderOverviewItemValue}>
        {match[1]}
        <span className={styles.TracePageHeaderOverviewItemValueDetail}>{match[2]}</span>
      </span>
    ) : (
      dateStr
    );
  };

  const title = (
    <h1 className={cx(styles.title)}>
      <TraceName traceName={getTraceName(trace.spans)} />
      <small className={styles.duration}>{formatDuration(trace.duration)}</small>
    </h1>
  );

  const { method, status, url } = getHeaderTags(trace.spans);
  let statusColor: BadgeColor = 'green';
  if (status && status.length > 0) {
    if (status[0].value.toString().charAt(0) === '4') {
      statusColor = 'orange';
    } else if (status[0].value.toString().charAt(0) === '5') {
      statusColor = 'red';
    }
  }

  const urlTooltip = (url: string) => {
    return (
      <>
        <div>
          <Trans
            i18nKey="explore.trace-page-header.tooltip-url"
            values={{
              url: 'http.url',
              target: 'http.target',
              path: 'http.path',
            }}
          >
            {'{{url}}'} or {'{{target}}'} or {'{{path}}'}
          </Trans>
        </div>
        <div>({url})</div>
      </>
    );
  };

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        {links && links.length > 0 && <ExternalLinks links={links} className={styles.TracePageHeaderBack} />}
        {title}
        <TracePageActions traceId={trace.traceID} data={data} app={app} />
      </div>

      <div className={styles.subtitle}>
        <span className={styles.timestamp}>{timestamp(trace, timeZone)}</span>
        <span className={styles.tagMeta}>
          {data.meta?.custom?.partial && (
            <Tooltip content={data.meta?.custom?.message} interactive={true}>
              <span className={styles.tag}>
                <Badge
                  icon={'info-circle'}
                  text={t('explore.trace-page-header.text-partial-trace', 'Partial trace')}
                  color={'orange'}
                />
              </span>
            </Tooltip>
          )}
          {method && method.length > 0 && (
            <Tooltip
              // eslint-disable-next-line @grafana/no-untranslated-strings
              content="http.method"
              interactive={true}
            >
              <span className={styles.tag}>
                <Badge text={method[0].value} color="blue" />
              </span>
            </Tooltip>
          )}
          {status && status.length > 0 && (
            <Tooltip
              // eslint-disable-next-line @grafana/no-untranslated-strings
              content="http.status_code"
              interactive={true}
            >
              <span className={styles.tag}>
                <Badge text={status[0].value} color={statusColor} />
              </span>
            </Tooltip>
          )}
          {url && url.length > 0 && (
            <Tooltip content={urlTooltip(url[0].value)} interactive={true}>
              <span className={styles.url}>{url[0].value}</span>
            </Tooltip>
          )}
        </span>
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

const getNewStyles = (theme: GrafanaTheme2) => {
  return {
    TracePageHeaderBack: css({
      label: 'TracePageHeaderBack',
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: '#fafafa',
      borderBottom: '1px solid #ddd',
      borderRight: '1px solid #ddd',
      color: 'inherit',
      display: 'flex',
      fontSize: '1.4rem',
      padding: '0 1rem',
      marginBottom: '-1px',
      '&:hover': {
        backgroundColor: '#f0f0f0',
        borderColor: '#ccc',
      },
    }),
    TracePageHeaderOverviewItemValueDetail: cx(
      css({
        label: 'TracePageHeaderOverviewItemValueDetail',
        color: '#aaa',
      }),
      'trace-item-value-detail'
    ),
    TracePageHeaderOverviewItemValue: css({
      label: 'TracePageHeaderOverviewItemValue',
      '&:hover > .trace-item-value-detail': {
        color: 'unset',
      },
    }),
    header: css({
      label: 'TracePageHeader',
      backgroundColor: theme.colors.background.primary,
      padding: '0.5em 0 0 0',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      textAlign: 'left',
    }),
    titleRow: css({
      alignItems: 'flex-start',
      display: 'flex',
      padding: '0 8px',
      flexWrap: 'wrap',
    }),
    title: css({
      color: 'inherit',
      flex: 1,
      fontSize: '1.7em',
      lineHeight: '1em',
      marginBottom: 0,
      minWidth: '200px',
    }),
    subtitle: css({
      flex: 1,
      lineHeight: '1em',
      margin: '-0.5em 0.5em 0.75em 0.5em',
    }),
    tag: css({
      margin: '0 0.5em 0 0',
    }),
    duration: css({
      color: '#aaa',
      margin: '0 0.75em',
    }),
    timestamp: css({
      verticalAlign: 'middle',
    }),
    tagMeta: css({
      margin: '0 0.75em',
      verticalAlign: 'text-top',
    }),
    url: css({
      margin: '-2.5px 0.3em',
      height: '15px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '700px',
      display: 'inline-block',
    }),
    TracePageHeaderTraceId: css({
      label: 'TracePageHeaderTraceId',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      maxWidth: '30%',
      display: 'inline-block',
    }),
  };
};
