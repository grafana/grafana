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
import { css } from 'emotion';
import cx from 'classnames';

import TimelineCollapser from './TimelineCollapser';
import TimelineColumnResizer from './TimelineColumnResizer';
import TimelineViewingLayer from './TimelineViewingLayer';
import Ticks from '../Ticks';
import TimelineRow from '../TimelineRow';
import { TUpdateViewRangeTimeFunction, ViewRangeTime, ViewRangeTimeUpdate } from '../types';
import { createStyle } from '../../Theme';
import { ubFlex, ubPx2 } from '../../uberUtilityStyles';

const getStyles = createStyle(() => {
  return {
    TimelineHeaderRow: css`
      background: #ececec;
      border-bottom: 1px solid #ccc;
      height: 38px;
      line-height: 38px;
      width: 100%;
      z-index: 4;
    `,
    title: css`
      flex: 1;
      overflow: hidden;
      margin: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    `,
  };
});

type TimelineHeaderRowProps = {
  duration: number;
  nameColumnWidth: number;
  numTicks: number;
  onCollapseAll: () => void;
  onCollapseOne: () => void;
  onColummWidthChange: (width: number) => void;
  onExpandAll: () => void;
  onExpandOne: () => void;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  viewRangeTime: ViewRangeTime;
};

export default function TimelineHeaderRow(props: TimelineHeaderRowProps) {
  const {
    duration,
    nameColumnWidth,
    numTicks,
    onCollapseAll,
    onCollapseOne,
    onColummWidthChange,
    onExpandAll,
    onExpandOne,
    updateViewRangeTime,
    updateNextViewRangeTime,
    viewRangeTime,
  } = props;
  const [viewStart, viewEnd] = viewRangeTime.current;
  const styles = getStyles();
  return (
    <TimelineRow className={styles.TimelineHeaderRow} data-test-id="TimelineHeaderRow">
      <TimelineRow.Cell className={cx(ubFlex, ubPx2)} width={nameColumnWidth}>
        <h3 className={styles.TimelineHeaderRow}>Service &amp; Operation</h3>
        <TimelineCollapser
          onCollapseAll={onCollapseAll}
          onExpandAll={onExpandAll}
          onCollapseOne={onCollapseOne}
          onExpandOne={onExpandOne}
        />
      </TimelineRow.Cell>
      <TimelineRow.Cell width={1 - nameColumnWidth}>
        <TimelineViewingLayer
          boundsInvalidator={nameColumnWidth}
          updateNextViewRangeTime={updateNextViewRangeTime}
          updateViewRangeTime={updateViewRangeTime}
          viewRangeTime={viewRangeTime}
        />
        <Ticks numTicks={numTicks} startTime={viewStart * duration} endTime={viewEnd * duration} showLabels />
      </TimelineRow.Cell>
      <TimelineColumnResizer position={nameColumnWidth} onChange={onColummWidthChange} min={0.2} max={0.85} />
    </TimelineRow>
  );
}
