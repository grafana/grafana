import React from 'react';

import { PanelPlugin, PanelProps } from '@grafana/data';
import { VizLayout } from '@grafana/ui';

import FlameGraphContainer from './components/FlameGraphContainer';

export const FlameGraphPanel: React.FunctionComponent<PanelProps> = (props) => {
  const { width, height } = props;

  return (
    <VizLayout width={width} height={height}>
      {() => {
        return <FlameGraphContainer data={props.data.series[0]} />;
      }}
    </VizLayout>
  );
};

export const plugin = new PanelPlugin(FlameGraphPanel);
