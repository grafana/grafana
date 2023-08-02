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
import { get as _get, maxBy as _maxBy, values as _values } from 'lodash';
import React from 'react';

import { dateTimeFormat, GrafanaTheme2, TimeZone } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import ExternalLinks from '../common/ExternalLinks';
import LabeledList from '../common/LabeledList';
import TraceName from '../common/TraceName';
import { autoColor, TUpdateViewRangeTimeFunction, ViewRange, ViewRangeTimeUpdate } from '../index';
import { getTraceLinks } from '../model/link-patterns';
import { getTraceName } from '../model/trace-viewer';
import { Trace } from '../types';
import { uTxMuted } from '../uberUtilityStyles';
import { formatDuration } from '../utils/date';

import SpanGraph from './SpanGraph';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    theme,
    TracePageHeader: css`
      label: TracePageHeader;
      & > :last-child {
        border-bottom: 1px solid ${autoColor(theme, '#ccc')};
      }
    `,
    TracePageHeaderTitleRow: css`
      label: TracePageHeaderTitleRow;
      align-items: center;
      display: flex;
    `,
    TracePageHeaderBack: css`
      label: TracePageHeaderBack;
      align-items: center;
      align-self: stretch;
      background-color: #fafafa;
      border-bottom: 1px solid #ddd;
      border-right: 1px solid #ddd;
      color: inherit;
      display: flex;
      font-size: 1.4rem;
      padding: 0 1rem;
      margin-bottom: -1px;
      &:hover {
        background-color: #f0f0f0;
        border-color: #ccc;
      }
    `,
    TracePageHeaderTitle: css`
      label: TracePageHeaderTitle;
      color: inherit;
      flex: 1;
      font-size: 1.7em;
      line-height: 1em;
      margin: 0 0 0 0.3em;
      padding-bottom: 0.5em;
    `,
    TracePageHeaderOverviewItems: css`
      label: TracePageHeaderOverviewItems;
      background-color: ${autoColor(theme, '#eee')};
      border-bottom: 1px solid ${autoColor(theme, '#e4e4e4')};
      padding: 0.25rem 0.5rem !important;
    `,
    TracePageHeaderOverviewItemValueDetail: cx(
      css`
        label: TracePageHeaderOverviewItemValueDetail;
        color: #aaa;
      `,
      'trace-item-value-detail'
    ),
    TracePageHeaderOverviewItemValue: css`
      label: TracePageHeaderOverviewItemValue;
      &:hover > .trace-item-value-detail {
        color: unset;
      }
    `,
    TracePageHeaderArchiveIcon: css`
      label: TracePageHeaderArchiveIcon;
      font-size: 1.78em;
      margin-right: 0.15em;
    `,
    TracePageHeaderTraceId: css`
      label: TracePageHeaderTraceId;
      white-space: nowrap;
    `,
    titleBorderBottom: css`
      border-bottom: 1px solid ${autoColor(theme, '#e8e8e8')};
    `,
  };
};

export type TracePageHeaderProps = {
  trace: Trace | null;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  viewRange: ViewRange;
  timeZone: TimeZone;
};

export const timestamp = (trace: Trace, timeZone: TimeZone, styles: ReturnType<typeof getStyles>) => {
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

export const HEADER_ITEMS = [
  {
    key: 'timestamp',
    label: 'Trace Start:',
    renderer: timestamp,
  },
  {
    key: 'duration',
    label: 'Duration:',
    renderer: (trace: Trace) => formatDuration(trace.duration),
  },
  {
    key: 'service-count',
    label: 'Services:',
    renderer: (trace: Trace) => new Set(_values(trace.processes).map((p) => p.serviceName)).size,
  },
  {
    key: 'depth',
    label: 'Depth:',
    renderer: (trace: Trace) => _get(_maxBy(trace.spans, 'depth'), 'depth', 0) + 1,
  },
  {
    key: 'span-count',
    label: 'Total Spans:',
    renderer: (trace: Trace) => trace.spans.length,
  },
];

export default function TracePageHeader(props: TracePageHeaderProps) {
  const { trace, updateNextViewRangeTime, updateViewRangeTime, viewRange, timeZone } = props;

  const styles = useStyles2(getStyles);
  const links = React.useMemo(() => {
    if (!trace) {
      return [];
    }
    return getTraceLinks(trace);
  }, [trace]);

  if (!trace) {
    return null;
  }

  const summaryItems = HEADER_ITEMS.map((item) => {
    const { renderer, ...rest } = item;
    return { ...rest, value: renderer(trace, timeZone, styles) };
  });

  const title = (
    <h1 className={styles.TracePageHeaderTitle}>
      <TraceName traceName={getTraceName(trace.spans)} />{' '}
      <small className={cx(styles.TracePageHeaderTraceId, uTxMuted)}>{trace.traceID}</small>
    </h1>
  );

  return (
    <header className={styles.TracePageHeader}>
      <div className={cx(styles.TracePageHeaderTitleRow, styles.titleBorderBottom)}>
        {links && links.length > 0 && <ExternalLinks links={links} className={styles.TracePageHeaderBack} />}
        {title}
      </div>
      {summaryItems && <LabeledList className={styles.TracePageHeaderOverviewItems} items={summaryItems} />}

      <SpanGraph
        trace={trace}
        viewRange={viewRange}
        updateNextViewRangeTime={updateNextViewRangeTime}
        updateViewRangeTime={updateViewRangeTime}
      />
    </header>
  );
}
