import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions, MySecureJsonData } from './types';

const { SecretFormField, FormField, Switch } = LegacyForms;

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export class ConfigEditor extends PureComponent<Props> {
  onEndpointChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      endpoint: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  // Secure field (only sent to the backend)
  onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonData: {
        apiKey: event.target.value,
      },
    });
  };

  onResetAPIKey = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        apiKey: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        apiKey: '',
      },
    });
  };

  toggleAuth = () => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      apikey_authentication_enabled: !options.jsonData.apikey_authentication_enabled,
    };
    onOptionsChange({ ...options, jsonData });
  };

  render() {
    const { options } = this.props;
    const { jsonData, secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;

    return (
      <div className="gf-form-group">
        <>
          <h3 className="page-heading">Backend</h3>
          <div className="gf-form-group">
            <div className="gf-form">
              <FormField
                label="Endpoint"
                labelWidth={6}
                inputWidth={20}
                onChange={this.onEndpointChange}
                value={jsonData.endpoint || ''}
                placeholder="Endpoint of the gRPC server"
                tooltip="Specify a complete HTTP URL (for example localhost:61858)"
              />
            </div>
          </div>
          <h3 className="page-heading">Auth</h3>
          {/*TODO styling: make sure width of toggle and API Key labels are equal*/}
          <Switch
            onChange={this.toggleAuth}
            label={'API Key Authentication'}
            key={'test key'}
            checked={jsonData.apikey_authentication_enabled}
          />
          <div className="gf-form-group" hidden={!jsonData.apikey_authentication_enabled}>
            <div className="gf-form">
              <SecretFormField
                isConfigured={(secureJsonFields && secureJsonFields.apiKey) as boolean}
                value={secureJsonData.apiKey || ''}
                label="API Key"
                placeholder="secure json field (backend only)"
                labelWidth={6}
                inputWidth={20}
                onReset={this.onResetAPIKey}
                onChange={this.onAPIKeyChange}
              />
            </div>
          </div>
        </>
      </div>
    );
  }
}
