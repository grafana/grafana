import React from 'react';
import { Dispatch } from 'redux';
import { GraphiteSegment } from '../types';
import { GraphiteQueryEditorState } from '../state/store';
import { MetricSegment } from './MetricSegment';

type Props = {
  segments: GraphiteSegment[];
  dispatch: Dispatch;
  state: GraphiteQueryEditorState;
};

export function MetricsSection({ dispatch, segments = [], state }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      {segments.map((segment, index) => {
        return <MetricSegment segment={segment} metricIndex={index} key={index} dispatch={dispatch} state={state} />;
      })}
    </div>
  );
}
