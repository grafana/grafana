import React, { PureComponent } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConnectionConfig } from '@grafana/google-sdk';
import { getBackendSrv, BackendSrv } from '@grafana/runtime';

import { CloudMonitoringOptions, CloudMonitoringSecureJsonData } from '../../types';

export type Props = DataSourcePluginOptionsEditorProps<CloudMonitoringOptions, CloudMonitoringSecureJsonData>;

export class ConfigEditor extends PureComponent<Props> {
  render() {
    const backendSrv: BackendSrv = getBackendSrv();
    return (
      <>
        <ConnectionConfig {...this.props} backendSrv={backendSrv}></ConnectionConfig>
      </>
    );
  }
}
