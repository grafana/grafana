import React, { PureComponent } from 'react';

import { QueryEditorHelpProps } from '@grafana/data/src';

import { InfluxCheatSheet } from './InfluxCheatSheet';

export default class InfluxStartPage extends PureComponent<QueryEditorHelpProps> {
  render() {
    return <InfluxCheatSheet />;
  }
}
