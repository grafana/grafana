import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { css } from '@emotion/css';

export class TracesPanel extends PureComponent<PanelProps> {
  render() {
    const { data } = this.props;

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
  }
}

const styles = {
  wrapper: css`
    height: 100%;
    overflow: scroll;
  `,
};
