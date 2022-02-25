import React from 'react';
import { DataFrame, LoadingState } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';

type Props = {
  panels: DataFrame;
  width: number;
};

export const SearchPagePanels = ({ panels, width }: Props) => {
  return (
    <>
      <h1>Panels ({panels.length})</h1>
      <PanelRenderer
        pluginId="table"
        title="Panels"
        data={{ series: [panels], state: LoadingState.Done } as any}
        options={{}}
        width={width}
        height={300}
        fieldConfig={{ defaults: {}, overrides: [] }}
        timeZone="browser"
      />
    </>
  );
};
