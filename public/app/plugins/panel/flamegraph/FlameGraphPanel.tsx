import React from 'react';

import { CoreApp, PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';

import { checkFields, CheckFieldsResult } from './components/FlameGraph/dataTransform';
import FlameGraphContainer from './components/FlameGraphContainer';

export const FlameGraphPanel = (props: PanelProps) => {
  const wrongFields = checkFields(props.data.series[0]);
  if (wrongFields) {
    return <PanelDataErrorView panelId={props.id} data={props.data} message={getMessageFromWrongFields(wrongFields)} />;
  }
  return <FlameGraphContainer data={props.data.series[0]} app={CoreApp.Unknown} />;
};

function getMessageFromWrongFields(wrongFields: CheckFieldsResult) {
  if (wrongFields.missingFields.length) {
    return `Data is missing fields: ${wrongFields.missingFields.join(', ')}`;
  }

  if (wrongFields.wrongTypeFields.length) {
    return `Data has fields of wrong type: ${wrongFields.wrongTypeFields
      .map((f) => `${f.name} has type ${f.type} but should be ${f.expectedTypes.join(' or ')}`)
      .join(', ')}`;
  }

  return '';
}
