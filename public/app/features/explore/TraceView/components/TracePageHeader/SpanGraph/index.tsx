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
import memoizeOne from 'memoize-one';
import * as React from 'react';

import { ViewRange, TUpdateViewRangeTimeFunction, ViewRangeTimeUpdate } from '../../TraceTimelineViewer/types';
import { Trace, TraceSpan } from '../../types/trace';

import CanvasSpanGraph from './CanvasSpanGraph';
import TickLabels from './TickLabels';
import ViewingLayer from './ViewingLayer';

const getStyles = () => {
  return {
    container: css({
      padding: '0 0.5rem 0.5rem 0.5rem',
    }),
    canvasContainer: css({
      position: 'relative',
    }),
  };
};

const DEFAULT_HEIGHT = 60;
export const TIMELINE_TICK_INTERVAL = 4;

export type SpanGraphProps = {
  height?: number;
  trace: Trace;
  viewRange: ViewRange;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  updateNextViewRangeTime: (nextUpdate: ViewRangeTimeUpdate) => void;
};

type SpanItem = {
  valueOffset: number;
  valueWidth: number;
  serviceName: string;
};

function getItem(span: TraceSpan): SpanItem {
  return {
    valueOffset: span.relativeStartTime,
    valueWidth: span.duration,
    serviceName: span.process.serviceName,
  };
}

function getItems(trace: Trace): SpanItem[] {
  return trace.spans.map(getItem);
}

const memoizedGetitems = memoizeOne(getItems);

export default class SpanGraph extends React.PureComponent<SpanGraphProps> {
  static defaultProps = {
    height: DEFAULT_HEIGHT,
  };

  render() {
    const { height, trace, viewRange, updateNextViewRangeTime, updateViewRangeTime } = this.props;
    const styles = getStyles();

    if (!trace) {
      return <div />;
    }

    const items = memoizedGetitems(trace);
    return (
      <div className={styles.container}>
        <TickLabels numTicks={TIMELINE_TICK_INTERVAL} duration={trace.duration} />
        <div className={styles.canvasContainer}>
          <CanvasSpanGraph valueWidth={trace.duration} items={items} />
          <ViewingLayer
            viewRange={viewRange}
            numTicks={TIMELINE_TICK_INTERVAL}
            height={height || DEFAULT_HEIGHT}
            updateViewRangeTime={updateViewRangeTime}
            updateNextViewRangeTime={updateNextViewRangeTime}
          />
        </div>
      </div>
    );
  }
}
