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
import cx from 'classnames';
import memoizeOne from 'memoize-one';
import * as React from 'react';
import { ubPb2, ubPx2, ubRelative } from '../../uberUtilityStyles';
import CanvasSpanGraph from './CanvasSpanGraph';
import TickLabels from './TickLabels';
import ViewingLayer from './ViewingLayer';
const DEFAULT_HEIGHT = 60;
export const TIMELINE_TICK_INTERVAL = 4;
function getItem(span) {
    return {
        valueOffset: span.relativeStartTime,
        valueWidth: span.duration,
        serviceName: span.process.serviceName,
    };
}
function getItems(trace) {
    return trace.spans.map(getItem);
}
const memoizedGetitems = memoizeOne(getItems);
export default class SpanGraph extends React.PureComponent {
    render() {
        const { height, trace, viewRange, updateNextViewRangeTime, updateViewRangeTime } = this.props;
        if (!trace) {
            return React.createElement("div", null);
        }
        const items = memoizedGetitems(trace);
        return (React.createElement("div", { className: cx(ubPb2, ubPx2) },
            React.createElement(TickLabels, { numTicks: TIMELINE_TICK_INTERVAL, duration: trace.duration }),
            React.createElement("div", { className: ubRelative },
                React.createElement(CanvasSpanGraph, { valueWidth: trace.duration, items: items }),
                React.createElement(ViewingLayer, { viewRange: viewRange, numTicks: TIMELINE_TICK_INTERVAL, height: height || DEFAULT_HEIGHT, updateViewRangeTime: updateViewRangeTime, updateNextViewRangeTime: updateNextViewRangeTime }))));
    }
}
SpanGraph.defaultProps = {
    height: DEFAULT_HEIGHT,
};
//# sourceMappingURL=index.js.map