import React from 'react';
import { DataFrame, LoadingState } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';

type Props = {
  dashboards: DataFrame;
  width: number;
};

export const SearchPageDashboards = ({ dashboards, width }: Props) => {
  return (
    <>
      <h1>Dashboards ({dashboards.length})</h1>
      <PanelRenderer
        pluginId="table"
        title="Dashboards"
        data={{ series: [dashboards], state: LoadingState.Done } as any}
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
