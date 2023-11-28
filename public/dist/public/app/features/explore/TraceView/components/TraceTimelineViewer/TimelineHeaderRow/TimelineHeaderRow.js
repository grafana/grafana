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
import * as React from 'react';
import { useStyles2 } from '@grafana/ui';
import { autoColor } from '../../Theme';
import { ubFlex, ubPx2 } from '../../uberUtilityStyles';
import Ticks from '../Ticks';
import TimelineRow from '../TimelineRow';
import { TimelineCollapser } from './TimelineCollapser';
import TimelineColumnResizer from './TimelineColumnResizer';
import TimelineViewingLayer from './TimelineViewingLayer';
const getStyles = (theme) => {
    return {
        TimelineHeaderRow: css `
      label: TimelineHeaderRow;
      background: ${autoColor(theme, '#ececec')};
      border-bottom: 1px solid ${autoColor(theme, '#ccc')};
      height: 38px;
      line-height: 38px;
      width: 100%;
      z-index: 4;
      position: relative;
    `,
        TimelineHeaderRowTitle: css `
      label: TimelineHeaderRowTitle;
      flex: 1;
      overflow: hidden;
      margin: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    `,
        TimelineHeaderWrapper: css `
      label: TimelineHeaderWrapper;
      align-items: center;
    `,
    };
};
export default function TimelineHeaderRow(props) {
    const { duration, nameColumnWidth, numTicks, onCollapseAll, onCollapseOne, onColummWidthChange, onExpandAll, onExpandOne, updateViewRangeTime, updateNextViewRangeTime, viewRangeTime, columnResizeHandleHeight, } = props;
    const [viewStart, viewEnd] = viewRangeTime.current;
    const styles = useStyles2(getStyles);
    return (React.createElement(TimelineRow, { className: styles.TimelineHeaderRow, "data-testid": "TimelineHeaderRow" },
        React.createElement(TimelineRow.Cell, { className: cx(ubFlex, ubPx2, styles.TimelineHeaderWrapper), width: nameColumnWidth },
            React.createElement("h4", { className: styles.TimelineHeaderRowTitle }, "Service & Operation"),
            React.createElement(TimelineCollapser, { onCollapseAll: onCollapseAll, onExpandAll: onExpandAll, onCollapseOne: onCollapseOne, onExpandOne: onExpandOne })),
        React.createElement(TimelineRow.Cell, { width: 1 - nameColumnWidth },
            React.createElement(TimelineViewingLayer, { boundsInvalidator: nameColumnWidth, updateNextViewRangeTime: updateNextViewRangeTime, updateViewRangeTime: updateViewRangeTime, viewRangeTime: viewRangeTime }),
            React.createElement(Ticks, { numTicks: numTicks, startTime: viewStart * duration, endTime: viewEnd * duration, showLabels: true })),
        React.createElement(TimelineColumnResizer, { columnResizeHandleHeight: columnResizeHandleHeight, position: nameColumnWidth, onChange: onColummWidthChange, min: 0.2, max: 0.85 })));
}
//# sourceMappingURL=TimelineHeaderRow.js.map