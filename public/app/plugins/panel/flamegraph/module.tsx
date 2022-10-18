import React from 'react';

import { PanelPlugin, PanelProps } from '@grafana/data';

import FlameGraphContainer from './components/FlameGraphContainer';

export const FlameGraphPanel: React.FunctionComponent<PanelProps> = (props) => {
  return <FlameGraphContainer data={props.data.series[0]} />;
};

export const plugin = new PanelPlugin(FlameGraphPanel);
