import React, { PureComponent } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConnectionConfig } from '@grafana/google-sdk';
import { SecureSocksProxySettings } from '@grafana/ui';
import { config } from 'app/core/config';

import { CloudMonitoringOptions, CloudMonitoringSecureJsonData } from '../../types';

export type Props = DataSourcePluginOptionsEditorProps<CloudMonitoringOptions, CloudMonitoringSecureJsonData>;

export class ConfigEditor extends PureComponent<Props> {
  render() {
    const { options, onOptionsChange } = this.props;
    return (
      <>
        <ConnectionConfig {...this.props}></ConnectionConfig>
        {config.featureToggles.secureSocksDatasourceProxy && (
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
        )}
      </>
    );
  }
}
