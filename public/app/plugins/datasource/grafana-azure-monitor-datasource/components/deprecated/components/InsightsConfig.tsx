import {
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
  updateDatasourcePluginSecureJsonDataOption,
} from '@grafana/data';
import { Alert, Button, InlineFormLabel, LegacyForms } from '@grafana/ui';
import React, { PureComponent } from 'react';

import { AzureDataSourceJsonData, AzureDataSourceSecureJsonData } from '../../../types';
import { Props } from '../../ConfigEditor';

const { Input } = LegacyForms;

export class InsightsConfig extends PureComponent<Props> {
  private onAppInsightsResetApiKey = () => {
    this.resetSecureKey('appInsightsApiKey');
  };

  private onUpdateJsonDataOption =
    (key: keyof AzureDataSourceJsonData) => (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateDatasourcePluginJsonDataOption(this.props, key, event.currentTarget.value);
    };

  private onUpdateSecureJsonDataOption =
    (key: keyof AzureDataSourceSecureJsonData) =>
    (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateDatasourcePluginSecureJsonDataOption(this.props, key, event.currentTarget.value);
    };

  private resetSecureKey = (key: keyof AzureDataSourceSecureJsonData) => {
    updateDatasourcePluginResetOption(this.props, key);
  };

  render() {
    const { options } = this.props;
    return (
      <>
        <h3 className="page-heading">Azure Application Insights</h3>
        <Alert severity="info" title="Application Insights credentials are deprecated">
          Configure using Azure AD App Registration above and update existing queries to use Metrics or Logs.
        </Alert>
        <div className="gf-form-group">
          {options.secureJsonFields.appInsightsApiKey ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineFormLabel className="width-12">API Key</InlineFormLabel>
                <Input className="width-25" placeholder="configured" disabled={true} />
              </div>
              <div className="gf-form">
                <div className="max-width-30 gf-form-inline">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={this.onAppInsightsResetApiKey}
                    disabled={this.props.options.readOnly}
                  >
                    reset
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineFormLabel className="width-12">API Key</InlineFormLabel>
                <div className="width-15">
                  <Input
                    className="width-30"
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    value={options.secureJsonData!.appInsightsApiKey || ''}
                    onChange={this.onUpdateSecureJsonDataOption('appInsightsApiKey')}
                    disabled={this.props.options.readOnly}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel className="width-12">Application ID</InlineFormLabel>
              <div className="width-15">
                <Input
                  className="width-30"
                  value={options.jsonData.appInsightsAppId || ''}
                  onChange={this.onUpdateJsonDataOption('appInsightsAppId')}
                  disabled={this.props.options.readOnly}
                />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default InsightsConfig;
