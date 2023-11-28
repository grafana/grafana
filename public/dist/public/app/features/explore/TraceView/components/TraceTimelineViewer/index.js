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
import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { stylesFactory, withTheme2 } from '@grafana/ui';
import { autoColor } from '../Theme';
import { merge as mergeShortcuts } from '../keyboard-shortcuts';
import TimelineHeaderRow from './TimelineHeaderRow';
import VirtualizedTraceView from './VirtualizedTraceView';
const getStyles = stylesFactory((theme) => {
    return {
        TraceTimelineViewer: css `
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
const NUM_TICKS = 5;
/**
 * `TraceTimelineViewer` now renders the header row because it is sensitive to
 * `props.viewRange.time.cursor`. If `VirtualizedTraceView` renders it, it will
 * re-render the ListView every time the cursor is moved on the trace minimap
 * or `TimelineHeaderRow`.
 */
export class UnthemedTraceTimelineViewer extends React.PureComponent {
    constructor(props) {
        super(props);
        this.collapseAll = () => {
            this.props.collapseAll(this.props.trace.spans);
            reportInteraction('grafana_traces_traceID_expand_collapse_clicked', {
                datasourceType: this.props.datasourceType,
                grafana_version: config.buildInfo.version,
                type: 'collapseAll',
            });
        };
        this.collapseOne = () => {
            this.props.collapseOne(this.props.trace.spans);
            reportInteraction('grafana_traces_traceID_expand_collapse_clicked', {
                datasourceType: this.props.datasourceType,
                grafana_version: config.buildInfo.version,
                type: 'collapseOne',
            });
        };
        this.expandAll = () => {
            this.props.expandAll();
            reportInteraction('grafana_traces_traceID_expand_collapse_clicked', {
                datasourceType: this.props.datasourceType,
                grafana_version: config.buildInfo.version,
                type: 'expandAll',
            });
        };
        this.expandOne = () => {
            this.props.expandOne(this.props.trace.spans);
            reportInteraction('grafana_traces_traceID_expand_collapse_clicked', {
                datasourceType: this.props.datasourceType,
                grafana_version: config.buildInfo.version,
                type: 'expandOne',
            });
        };
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
    render() {
        const _a = this.props, { setSpanNameColumnWidth, updateNextViewRangeTime, updateViewRangeTime, viewRange, traceTimeline, theme, topOfViewRef, focusedSpanIdForSearch } = _a, rest = __rest(_a, ["setSpanNameColumnWidth", "updateNextViewRangeTime", "updateViewRangeTime", "viewRange", "traceTimeline", "theme", "topOfViewRef", "focusedSpanIdForSearch"]);
        const { trace } = rest;
        const styles = getStyles(theme);
        return (React.createElement("div", { className: styles.TraceTimelineViewer, ref: (ref) => ref && this.setState({ height: ref.getBoundingClientRect().height }) },
            React.createElement(TimelineHeaderRow, { duration: trace.duration, nameColumnWidth: traceTimeline.spanNameColumnWidth, numTicks: NUM_TICKS, onCollapseAll: this.collapseAll, onCollapseOne: this.collapseOne, onColummWidthChange: setSpanNameColumnWidth, onExpandAll: this.expandAll, onExpandOne: this.expandOne, viewRangeTime: viewRange.time, updateNextViewRangeTime: updateNextViewRangeTime, updateViewRangeTime: updateViewRangeTime, columnResizeHandleHeight: this.state.height }),
            React.createElement(VirtualizedTraceView, Object.assign({}, rest, traceTimeline, { setSpanNameColumnWidth: setSpanNameColumnWidth, currentViewRangeTime: viewRange.time.current, topOfViewRef: topOfViewRef, focusedSpanIdForSearch: focusedSpanIdForSearch, datasourceType: this.props.datasourceType }))));
    }
}
export default withTheme2(UnthemedTraceTimelineViewer);
//# sourceMappingURL=index.js.map