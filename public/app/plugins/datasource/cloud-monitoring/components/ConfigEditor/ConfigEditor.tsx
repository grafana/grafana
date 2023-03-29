import React, { PureComponent } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConnectionConfig } from '@grafana/google-sdk';
import { reportInteraction } from '@grafana/runtime';
import { SecureSocksProxySettings } from '@grafana/ui';
import { config } from 'app/core/config';

import { CloudMonitoringOptions, CloudMonitoringSecureJsonData } from '../../types';

export type Props = DataSourcePluginOptionsEditorProps<CloudMonitoringOptions, CloudMonitoringSecureJsonData>;

export class ConfigEditor extends PureComponent<Props> {
  handleOnOptionsChange = (options: Props['options']) => {
    if (options.jsonData.privateKeyPath || options.secureJsonFields['privateKey']) {
      reportInteraction('grafana_cloud_monitoring_config_changed', {
        authenticationType: 'JWT',
        privateKey: options.secureJsonFields['privateKey'],
        privateKeyPath: !!options.jsonData.privateKeyPath,
      });
    }
    this.props.onOptionsChange(options);
  };

  render() {
    const { options, onOptionsChange } = this.props;
    return (
      <>
        <ConnectionConfig {...this.props} onOptionsChange={this.handleOnOptionsChange}></ConnectionConfig>
        {config.featureToggles.secureSocksDatasourceProxy && (
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
        )}
      </>
    );
  }
}
