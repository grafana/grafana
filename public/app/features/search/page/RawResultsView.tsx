import React from 'react';
import { DataFrame, LoadingState } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';

type Props = {
  frame: DataFrame;
  width: number;
};

export const RawResultsView = ({ frame, width }: Props) => {
  return (
    <>
      <h1>Results ({frame.length})</h1>
      <PanelRenderer
        pluginId="table"
        title="Results"
        data={{ series: [frame], state: LoadingState.Done } as any}
        options={{}}
        width={width}
        height={300}
        fieldConfig={{ defaults: {}, overrides: [] }}
        timeZone="browser"
      />
      <br />
    </>
  );
};
