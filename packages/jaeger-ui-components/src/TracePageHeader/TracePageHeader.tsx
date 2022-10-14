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
import * as React from 'react';
import MdKeyboardArrowRight from 'react-icons/lib/md/keyboard-arrow-right';

import { dateTimeFormat, GrafanaTheme2, TimeZone } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { autoColor, TUpdateViewRangeTimeFunction, ViewRange, ViewRangeTimeUpdate } from '..';
import ExternalLinks from '../common/ExternalLinks';
import LabeledList from '../common/LabeledList';
import TraceName from '../common/TraceName';
import { getTraceLinks } from '../model/link-patterns';
import { getTraceName } from '../model/trace-viewer';
import { Trace } from '../types/trace';
import { uTxMuted } from '../uberUtilityStyles';
import { formatDuration } from '../utils/date';

import SpanGraph from './SpanGraph';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    TracePageHeader: css`
      label: TracePageHeader;
      & > :first-child {
        border-bottom: 1px solid ${autoColor(theme, '#e8e8e8')};
      }
      & > :nth-child(2) {
        background-color: ${autoColor(theme, '#eee')};
        border-bottom: 1px solid ${autoColor(theme, '#e4e4e4')};
      }
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
    TracePageHeaderTitleLink: css`
      label: TracePageHeaderTitleLink;
      align-items: center;
      display: flex;
      flex: 1;

      &:hover * {
        text-decoration: underline;
      }
      &:hover > *,
      &:hover small {
        text-decoration: none;
      }
      /* Adapt styles when changing from a element into button */
      background: transparent;
      text-align: left;
      border: none;
    `,
    TracePageHeaderDetailToggle: css`
      label: TracePageHeaderDetailToggle;
      font-size: 2.5rem;
      transition: transform 0.07s ease-out;
    `,
    TracePageHeaderDetailToggleExpanded: css`
      label: TracePageHeaderDetailToggleExpanded;
      transform: rotate(90deg);
    `,
    TracePageHeaderTitle: css`
      label: TracePageHeaderTitle;
      color: inherit;
      flex: 1;
      font-size: 1.7em;
      line-height: 1em;
      margin: 0 0 0 0.5em;
      padding-bottom: 0.5em;
    `,
    TracePageHeaderTitleCollapsible: css`
      label: TracePageHeaderTitleCollapsible;
      margin-left: 0;
    `,
    TracePageHeaderOverviewItems: css`
      label: TracePageHeaderOverviewItems;
      border-bottom: 1px solid #e4e4e4;
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
  };
};

type TracePageHeaderEmbedProps = {
  canCollapse: boolean;
  hideMap: boolean;
  hideSummary: boolean;
  onSlimViewClicked: () => void;
  onTraceGraphViewClicked: () => void;
  slimView: boolean;
  trace: Trace;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  viewRange: ViewRange;
  timeZone: TimeZone;
};

export const HEADER_ITEMS = [
  {
    key: 'timestamp',
    label: 'Trace Start:',
    renderer(trace: Trace, timeZone: TimeZone, styles: ReturnType<typeof getStyles>) {
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
    },
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

export default function TracePageHeader(props: TracePageHeaderEmbedProps) {
  const {
    canCollapse,
    hideMap,
    hideSummary,
    onSlimViewClicked,
    slimView,
    trace,
    updateNextViewRangeTime,
    updateViewRangeTime,
    viewRange,
    timeZone,
  } = props;

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

  const summaryItems =
    !hideSummary &&
    !slimView &&
    HEADER_ITEMS.map((item) => {
      const { renderer, ...rest } = item;
      return { ...rest, value: renderer(trace, timeZone, styles) };
    });

  const title = (
    <h1 className={cx(styles.TracePageHeaderTitle, canCollapse && styles.TracePageHeaderTitleCollapsible)}>
      <TraceName traceName={getTraceName(trace.spans)} />{' '}
      <small className={cx(styles.TracePageHeaderTraceId, uTxMuted)}>{trace.traceID}</small>
    </h1>
  );

  return (
    <header className={styles.TracePageHeader}>
      <div className={styles.TracePageHeaderTitleRow}>
        {links && links.length > 0 && <ExternalLinks links={links} className={styles.TracePageHeaderBack} />}
        {canCollapse ? (
          <button
            type="button"
            className={styles.TracePageHeaderTitleLink}
            onClick={onSlimViewClicked}
            role="switch"
            aria-checked={!slimView}
          >
            <MdKeyboardArrowRight
              className={cx(
                styles.TracePageHeaderDetailToggle,
                !slimView && styles.TracePageHeaderDetailToggleExpanded
              )}
            />
            {title}
          </button>
        ) : (
          title
        )}
      </div>
      {summaryItems && <LabeledList className={styles.TracePageHeaderOverviewItems} items={summaryItems} />}
      {!hideMap && !slimView && (
        <SpanGraph
          trace={trace}
          viewRange={viewRange}
          updateNextViewRangeTime={updateNextViewRangeTime}
          updateViewRangeTime={updateViewRangeTime}
        />
      )}
    </header>
  );
}
