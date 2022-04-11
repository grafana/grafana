import React from 'react';
import { PanelProps } from '@grafana/data';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { css } from '@emotion/css';

const styles = {
  wrapper: css`
    height: 100%;
    overflow: scroll;
  `,
};

export const TracesPanel: React.FunctionComponent<PanelProps> = ({ data }) => {
  if (!data || !data.series.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <TraceView dataFrames={data.series} queryResponse={data} />
    </div>
  );
};
