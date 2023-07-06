import React from 'react';

import { CoreApp, PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';

import FlameGraphContainer from './components/FlameGraphContainer';
import FlameGraphContainerV2 from './flamegraphV2/components/FlameGraphContainer';

export const FlameGraphPanel = (props: PanelProps) => {
  return config.featureToggles.flameGraphV2 ? (
    <FlameGraphContainerV2 data={props.data.series[0]} app={CoreApp.Unknown} />
  ) : (
    <FlameGraphContainer data={props.data.series[0]} app={CoreApp.Unknown} />
  );
};
