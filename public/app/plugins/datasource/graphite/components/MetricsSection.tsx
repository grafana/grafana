import React from 'react';
import { Dispatch } from 'redux';
import { GraphiteSegment } from '../types';
import { GraphiteQueryEditorState } from '../state/store';
import { MetricSegment } from './MetricSegment';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

type Props = {
  segments: GraphiteSegment[];
  dispatch: Dispatch;
  state: GraphiteQueryEditorState;
};

export function MetricsSection({ dispatch, segments = [], state }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      {segments.map((segment, index) => {
        return <MetricSegment segment={segment} metricIndex={index} key={index} dispatch={dispatch} state={state} />;
      })}
    </div>
  );
}

function getStyles() {
  return {
    container: css`
      display: flex;
      flex-direction: row;
    `,
  };
}
