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

import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { stylesFactory, withTheme2 } from '@grafana/ui';

import TimelineHeaderRow from './TimelineHeaderRow';
import VirtualizedTraceView from './VirtualizedTraceView';
import { merge as mergeShortcuts } from '../keyboard-shortcuts';
import { Accessors } from '../ScrollManager';
import { TUpdateViewRangeTimeFunction, ViewRange, ViewRangeTimeUpdate } from './types';
import { SpanLinkFunc, TNil } from '../types';
import { TraceSpan, Trace, TraceLog, TraceKeyValuePair, TraceLink, TraceSpanReference } from '../types/trace';
import TTraceTimeline from '../types/TTraceTimeline';
import { autoColor } from '../Theme';
import ExternalLinkContext from '../url/externalLinkContext';

type TExtractUiFindFromStateReturn = {
  uiFind: string | undefined;
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    TraceTimelineViewer: css`
      label: TraceTimelineViewer;
      border-bottom: 1px solid ${autoColor(theme, '#bbb')};

      & .json-markup {
        line-height: 17px;
        font-size: 13px;
        font-family: monospace;
        white-space: pre-wrap;
      }

      & .json-markup-key {
        font-weight: bold;
      }

      & .json-markup-bool {
        color: ${autoColor(theme, 'firebrick')};
      }

      & .json-markup-string {
        color: ${autoColor(theme, 'teal')};
      }

      & .json-markup-null {
        color: ${autoColor(theme, 'teal')};
      }

      & .json-markup-number {
        color: ${autoColor(theme, 'blue', 'black')};
      }
    `,
  };
});

type TProps = TExtractUiFindFromStateReturn & {
  registerAccessors: (accessors: Accessors) => void;
  findMatchesIDs: Set<string> | TNil;
  scrollToFirstVisibleSpan: () => void;
  traceTimeline: TTraceTimeline;
  trace: Trace;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  viewRange: ViewRange;
  focusSpan: (uiFind: string) => void;
  createLinkToExternalSpan: (traceID: string, spanID: string) => string;

  setSpanNameColumnWidth: (width: number) => void;
  collapseAll: (spans: TraceSpan[]) => void;
  collapseOne: (spans: TraceSpan[]) => void;
  expandAll: () => void;
  expandOne: (spans: TraceSpan[]) => void;

  childrenToggle: (spanID: string) => void;
  clearShouldScrollToFirstUiFindMatch: () => void;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  detailLogsToggle: (spanID: string) => void;
  detailWarningsToggle: (spanID: string) => void;
  detailStackTracesToggle: (spanID: string) => void;
  detailReferencesToggle: (spanID: string) => void;
  detailReferenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  detailProcessToggle: (spanID: string) => void;
  detailTagsToggle: (spanID: string) => void;
  detailToggle: (spanID: string) => void;
  setTrace: (trace: Trace | TNil, uiFind: string | TNil) => void;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  linksGetter: (span: TraceSpan, items: TraceKeyValuePair[], itemIndex: number) => TraceLink[];
  theme: GrafanaTheme2;
  createSpanLink?: SpanLinkFunc;
  scrollElement?: Element;
  focusedSpanId?: string;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
};

type State = {
  // Will be set to real height of the component so it can be passed down to size some other elements.
  height: number;
};

const NUM_TICKS = 5;

/**
 * `TraceTimelineViewer` now renders the header row because it is sensitive to
 * `props.viewRange.time.cursor`. If `VirtualizedTraceView` renders it, it will
 * re-render the ListView every time the cursor is moved on the trace minimap
 * or `TimelineHeaderRow`.
 */
export class UnthemedTraceTimelineViewer extends React.PureComponent<TProps, State> {
  constructor(props: TProps) {
    super(props);
    this.state = { height: 0 };
  }

  componentDidMount() {
    mergeShortcuts({
      collapseAll: this.collapseAll,
      expandAll: this.expandAll,
      collapseOne: this.collapseOne,
      expandOne: this.expandOne,
    });
  }

  collapseAll = () => {
    this.props.collapseAll(this.props.trace.spans);
  };

  collapseOne = () => {
    this.props.collapseOne(this.props.trace.spans);
  };

  expandAll = () => {
    this.props.expandAll();
  };

  expandOne = () => {
    this.props.expandOne(this.props.trace.spans);
  };

  render() {
    const {
      setSpanNameColumnWidth,
      updateNextViewRangeTime,
      updateViewRangeTime,
      viewRange,
      createLinkToExternalSpan,
      traceTimeline,
      theme,
      ...rest
    } = this.props;
    const { trace } = rest;
    const styles = getStyles(theme);

    return (
      <ExternalLinkContext.Provider value={createLinkToExternalSpan}>
        <div
          className={styles.TraceTimelineViewer}
          ref={(ref: HTMLDivElement | null) => ref && this.setState({ height: ref.getBoundingClientRect().height })}
        >
          <TimelineHeaderRow
            duration={trace.duration}
            nameColumnWidth={traceTimeline.spanNameColumnWidth}
            numTicks={NUM_TICKS}
            onCollapseAll={this.collapseAll}
            onCollapseOne={this.collapseOne}
            onColummWidthChange={setSpanNameColumnWidth}
            onExpandAll={this.expandAll}
            onExpandOne={this.expandOne}
            viewRangeTime={viewRange.time}
            updateNextViewRangeTime={updateNextViewRangeTime}
            updateViewRangeTime={updateViewRangeTime}
            columnResizeHandleHeight={this.state.height}
          />
          <VirtualizedTraceView
            {...rest}
            {...traceTimeline}
            setSpanNameColumnWidth={setSpanNameColumnWidth}
            currentViewRangeTime={viewRange.time.current}
          />
        </div>
      </ExternalLinkContext.Provider>
    );
  }
}

export default withTheme2(UnthemedTraceTimelineViewer);
