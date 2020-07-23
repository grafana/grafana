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

import * as React from 'react';
import _get from 'lodash/get';
import _maxBy from 'lodash/maxBy';
import _values from 'lodash/values';
import MdKeyboardArrowRight from 'react-icons/lib/md/keyboard-arrow-right';
import { css } from 'emotion';
import cx from 'classnames';

import SpanGraph from './SpanGraph';
import TracePageSearchBar from './TracePageSearchBar';
import { autoColor, Theme, TUpdateViewRangeTimeFunction, useTheme, ViewRange, ViewRangeTimeUpdate } from '..';
import LabeledList from '../common/LabeledList';
import TraceName from '../common/TraceName';
import { getTraceName } from '../model/trace-viewer';
import { TNil } from '../types';
import { Trace } from '@grafana/data';
import { formatDatetime, formatDuration } from '../utils/date';
import { getTraceLinks } from '../model/link-patterns';

import ExternalLinks from '../common/ExternalLinks';
import { createStyle } from '../Theme';
import { uTxMuted } from '../uberUtilityStyles';
import { useMemo } from 'react';

const getStyles = createStyle((theme: Theme) => {
  const TracePageHeaderOverviewItemValueDetail = css`
    label: TracePageHeaderOverviewItemValueDetail;
    color: #aaa;
  `;
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
      padding: 0.5em 0;
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
    TracePageHeaderOverviewItemValueDetail,
    TracePageHeaderOverviewItemValue: css`
      label: TracePageHeaderOverviewItemValue;
      &:hover > .${TracePageHeaderOverviewItemValueDetail} {
        color: unset;
      }
    `,
    TracePageHeaderArchiveIcon: css`
      label: TracePageHeaderArchiveIcon;
      font-size: 1.78em;
      margin-right: 0.15em;
    `,
  };
});

type TracePageHeaderEmbedProps = {
  canCollapse: boolean;
  clearSearch: () => void;
  focusUiFindMatches: () => void;
  hideMap: boolean;
  hideSummary: boolean;
  nextResult: () => void;
  onSlimViewClicked: () => void;
  onTraceGraphViewClicked: () => void;
  prevResult: () => void;
  resultCount: number;
  slimView: boolean;
  textFilter: string | TNil;
  trace: Trace;
  traceGraphView: boolean;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  viewRange: ViewRange;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  hideSearchButtons?: boolean;
};

export const HEADER_ITEMS = [
  {
    key: 'timestamp',
    label: 'Trace Start',
    renderer: (trace: Trace) => {
      const styles = getStyles(useTheme());
      const dateStr = formatDatetime(trace.startTime);
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
    label: 'Duration',
    renderer: (trace: Trace) => formatDuration(trace.duration),
  },
  {
    key: 'service-count',
    label: 'Services',
    renderer: (trace: Trace) => new Set(_values(trace.processes).map(p => p.serviceName)).size,
  },
  {
    key: 'depth',
    label: 'Depth',
    renderer: (trace: Trace) => _get(_maxBy(trace.spans, 'depth'), 'depth', 0) + 1,
  },
  {
    key: 'span-count',
    label: 'Total Spans',
    renderer: (trace: Trace) => trace.spans.length,
  },
];

export default function TracePageHeader(props: TracePageHeaderEmbedProps) {
  const {
    canCollapse,
    clearSearch,
    focusUiFindMatches,
    hideMap,
    hideSummary,
    nextResult,
    onSlimViewClicked,
    prevResult,
    resultCount,
    slimView,
    textFilter,
    trace,
    traceGraphView,
    updateNextViewRangeTime,
    updateViewRangeTime,
    viewRange,
    searchValue,
    onSearchValueChange,
    hideSearchButtons,
  } = props;

  if (!trace) {
    return null;
  }

  const links = useMemo(() => getTraceLinks(trace), [trace]);

  const summaryItems =
    !hideSummary &&
    !slimView &&
    HEADER_ITEMS.map(item => {
      const { renderer, ...rest } = item;
      return { ...rest, value: renderer(trace) };
    });

  const styles = getStyles(useTheme());

  const title = (
    <h1 className={cx(styles.TracePageHeaderTitle, canCollapse && styles.TracePageHeaderTitleCollapsible)}>
      <TraceName traceName={getTraceName(trace.spans)} />{' '}
      <small className={uTxMuted}>{trace.traceID.slice(0, 7)}</small>
    </h1>
  );

  return (
    <header className={styles.TracePageHeader}>
      <div className={styles.TracePageHeaderTitleRow}>
        {links && links.length > 0 && <ExternalLinks links={links} className={styles.TracePageHeaderBack} />}
        {canCollapse ? (
          <a
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
          </a>
        ) : (
          title
        )}
        <TracePageSearchBar
          clearSearch={clearSearch}
          focusUiFindMatches={focusUiFindMatches}
          nextResult={nextResult}
          prevResult={prevResult}
          resultCount={resultCount}
          textFilter={textFilter}
          navigable={!traceGraphView}
          searchValue={searchValue}
          onSearchValueChange={onSearchValueChange}
          hideSearchButtons={hideSearchButtons}
        />
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
