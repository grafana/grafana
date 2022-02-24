import React, { PureComponent } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { CloudMonitoringOptions, CloudMonitoringSecureJsonData } from '../../types';
import { ConnectionConfig } from '@grafana/google-sdk';

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
