import React from 'react';

import { CoreApp, PanelProps } from '@grafana/data';

import FlameGraphContainer from './components/FlameGraphContainer';

export const FlameGraphPanel: React.FunctionComponent<PanelProps> = (props) => {
  return <FlameGraphContainer data={props.data.series[0]} app={CoreApp.Unknown} flameGraphHeight={props.height} />;
};
