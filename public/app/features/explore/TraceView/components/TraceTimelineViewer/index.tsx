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
import { memo, useCallback, useEffect, useState, type RefObject } from 'react';

import { type CoreApp, type GrafanaTheme2, type LinkModel, type TimeRange, type TraceLog } from '@grafana/data';
import { type SpanBarOptions, type TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { config, reportInteraction } from '@grafana/runtime';
import { type TimeZone } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

import { autoColor } from '../Theme';
import { merge as mergeShortcuts } from '../keyboard-shortcuts';
import type TNil from '../types/TNil';
import type TTraceTimeline from '../types/TTraceTimeline';
import { type SpanLinkFunc } from '../types/links';
import { type TraceSpan, type Trace, type TraceSpanReference, type CriticalPathSection } from '../types/trace';

import { type TraceFlameGraphs } from './SpanDetail';
import TimelineHeaderRow from './TimelineHeaderRow/TimelineHeaderRow';
import VirtualizedTraceView from './VirtualizedTraceView';
import { type TUpdateViewRangeTimeFunction, type ViewRange, type ViewRangeTimeUpdate } from './types';

function getStyles(theme: GrafanaTheme2) {
  return {
    TraceTimelineViewer: css({
      label: 'TraceTimelineViewer',
      borderBottom: `1px solid ${autoColor(theme, '#bbb')}`,

      '& .json-markup': {
        lineHeight: '17px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
      },

      '& .json-markup-key': {
        fontWeight: 'bold',
      },

      '& .json-markup-bool': {
        color: autoColor(theme, 'firebrick'),
      },

      '& .json-markup-string': {
        color: autoColor(theme, 'teal'),
      },

      '& .json-markup-null': {
        color: autoColor(theme, 'teal'),
      },

      '& .json-markup-number': {
        color: autoColor(theme, 'blue', 'black'),
      },
    }),
  };
}

export type TProps = {
  findMatchesIDs: Set<string> | TNil;
  traceTimeline: TTraceTimeline;
  trace: Trace;
  traceToProfilesOptions?: TraceToProfilesOptions;
  datasourceType: string;
  datasourceUid: string;
  spanBarOptions: SpanBarOptions | undefined;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  viewRange: ViewRange;
  timeZone: TimeZone;

  setSpanNameColumnWidth: (width: number) => void;
  collapseAll: (spans: TraceSpan[]) => void;
  collapseOne: (spans: TraceSpan[]) => void;
  expandAll: () => void;
  expandOne: (spans: TraceSpan[]) => void;

  childrenToggle: (spanID: string) => void;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  detailLogsToggle: (spanID: string) => void;
  detailWarningsToggle: (spanID: string) => void;
  detailStackTracesToggle: (spanID: string) => void;
  detailReferencesToggle: (spanID: string) => void;
  detailReferenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  detailProcessToggle: (spanID: string) => void;
  detailTagsToggle: (spanID: string) => void;
  detailToggle: (spanID: string) => void;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  createSpanLink?: SpanLinkFunc;
  scrollElement?: Element;
  focusedSpanId?: string;
  focusedSpanIdForSearch: string;
  showSpanFilterMatchesOnly: boolean;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  topOfViewRef?: RefObject<HTMLDivElement | null>;
  headerHeight: number;
  criticalPath: CriticalPathSection[];
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  redrawListView: {};
  setRedrawListView: (redraw: {}) => void;
  timeRange: TimeRange;
  app: CoreApp;
};

const NUM_TICKS = 5;

/**
 * `TraceTimelineViewer` now renders the header row because it is sensitive to
 * `props.viewRange.time.cursor`. If `VirtualizedTraceView` renders it, it will
 * re-render the ListView every time the cursor is moved on the trace minimap
 * or `TimelineHeaderRow`.
 */
export const UnthemedTraceTimelineViewer = memo(function UnthemedTraceTimelineViewer(props: TProps) {
  const {
    setSpanNameColumnWidth,
    updateNextViewRangeTime,
    updateViewRangeTime,
    viewRange,
    traceTimeline,
    topOfViewRef,
    focusedSpanIdForSearch,
    ...rest
  } = props;

  const { trace, collapseAll, collapseOne, expandAll, expandOne, datasourceType, datasourceUid } = rest;

  const styles = useStyles2(getStyles);
  const [height, setHeight] = useState(0);

  const handleCollapseAll = useCallback(() => {
    collapseAll(trace.spans);
    reportInteraction('grafana_traces_traceID_expand_collapse_clicked', {
      datasourceType,
      grafana_version: config.buildInfo.version,
      type: 'collapseAll',
    });
  }, [collapseAll, datasourceType, trace.spans]);

  const handleCollapseOne = useCallback(() => {
    collapseOne(trace.spans);
    reportInteraction('grafana_traces_traceID_expand_collapse_clicked', {
      datasourceType,
      grafana_version: config.buildInfo.version,
      type: 'collapseOne',
    });
  }, [collapseOne, datasourceType, trace.spans]);

  const handleExpandAll = useCallback(() => {
    expandAll();
    reportInteraction('grafana_traces_traceID_expand_collapse_clicked', {
      datasourceType,
      grafana_version: config.buildInfo.version,
      type: 'expandAll',
    });
  }, [expandAll, datasourceType]);

  const handleExpandOne = useCallback(() => {
    expandOne(trace.spans);
    reportInteraction('grafana_traces_traceID_expand_collapse_clicked', {
      datasourceType,
      grafana_version: config.buildInfo.version,
      type: 'expandOne',
    });
  }, [expandOne, datasourceType, trace.spans]);

  useEffect(() => {
    mergeShortcuts({
      collapseAll: handleCollapseAll,
      expandAll: handleExpandAll,
      collapseOne: handleCollapseOne,
      expandOne: handleExpandOne,
    });
  }, [handleCollapseAll, handleCollapseOne, handleExpandAll, handleExpandOne]);

  return (
    <div
      className={styles.TraceTimelineViewer}
      ref={(ref) => {
        if (ref) {
          setHeight(ref.getBoundingClientRect().height);
        }
      }}
    >
      <TimelineHeaderRow
        duration={trace.duration}
        nameColumnWidth={traceTimeline.spanNameColumnWidth}
        numTicks={NUM_TICKS}
        onCollapseAll={handleCollapseAll}
        onCollapseOne={handleCollapseOne}
        onColummWidthChange={setSpanNameColumnWidth}
        onExpandAll={handleExpandAll}
        onExpandOne={handleExpandOne}
        viewRangeTime={viewRange.time}
        updateNextViewRangeTime={updateNextViewRangeTime}
        updateViewRangeTime={updateViewRangeTime}
        columnResizeHandleHeight={height}
      />
      <VirtualizedTraceView
        {...rest}
        {...traceTimeline}
        setSpanNameColumnWidth={setSpanNameColumnWidth}
        currentViewRangeTime={viewRange.time.current}
        topOfViewRef={topOfViewRef}
        focusedSpanIdForSearch={focusedSpanIdForSearch}
        datasourceType={datasourceType}
        datasourceUid={datasourceUid}
      />
    </div>
  );
});

export default UnthemedTraceTimelineViewer;
