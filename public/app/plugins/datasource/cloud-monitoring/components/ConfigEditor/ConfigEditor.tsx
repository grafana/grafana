import React, { PureComponent } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConnectionConfig } from '@grafana/google-sdk';

import { CloudMonitoringOptions, CloudMonitoringSecureJsonData } from '../../types';

export type Props = DataSourcePluginOptionsEditorProps<CloudMonitoringOptions, CloudMonitoringSecureJsonData>;

export class ConfigEditor extends PureComponent<Props> {
  render() {
    return (
      <>
        <ConnectionConfig {...this.props}></ConnectionConfig>
      </>
    );
  }
}
