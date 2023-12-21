// Libraries
import React, { PureComponent } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';

type Props = DataSourcePluginOptionsEditorProps;

/**
 * Empty Config Editor -- settings to save
 */
export class ConfigEditor extends PureComponent<Props> {
  render() {
    return <div />;
  }
}
