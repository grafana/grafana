import React from 'react';

import { CoreApp, PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';

import { checkFields, getMessageCheckFieldsResult } from './components/FlameGraph/dataTransform';
import FlameGraphContainer from './components/FlameGraphContainer';

export const FlameGraphPanel = (props: PanelProps) => {
  const wrongFields = checkFields(props.data.series[0]);
  if (wrongFields) {
    return (
      <PanelDataErrorView panelId={props.id} data={props.data} message={getMessageCheckFieldsResult(wrongFields)} />
    );
  }
  return <FlameGraphContainer data={props.data.series[0]} app={CoreApp.Unknown} />;
};
