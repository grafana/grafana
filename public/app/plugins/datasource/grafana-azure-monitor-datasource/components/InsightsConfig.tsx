import React, { PureComponent } from 'react';
import { InlineFormLabel, Button, LegacyForms } from '@grafana/ui';
const { Input } = LegacyForms;
import { AzureDataSourceSettings, AzureDataSourceJsonData, AzureDataSourceSecureJsonData } from '../types';

export interface Props {
  options: AzureDataSourceSettings;
  onUpdateJsonDataOption: (
    key: keyof AzureDataSourceJsonData
  ) => (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onUpdateSecureJsonDataOption: (
    key: keyof AzureDataSourceSecureJsonData
  ) => (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onResetOptionKey: (key: string) => void;
}
export class InsightsConfig extends PureComponent<Props> {
  onAppInsightsResetApiKey = () => {
    this.props.onResetOptionKey('appInsightsApiKey');
  };

  render() {
    const { options, onUpdateJsonDataOption, onUpdateSecureJsonDataOption } = this.props;
    return (
      <>
        <h3 className="page-heading">Application Insights Details</h3>
        <div className="gf-form-group">
          {options.secureJsonFields.appInsightsApiKey ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineFormLabel className="width-12">API Key</InlineFormLabel>
                <Input className="width-25" placeholder="configured" disabled={true} />
              </div>
              <div className="gf-form">
                <div className="max-width-30 gf-form-inline">
                  <Button variant="secondary" type="button" onClick={this.onAppInsightsResetApiKey}>
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
                    onChange={onUpdateSecureJsonDataOption('appInsightsApiKey')}
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
                  onChange={onUpdateJsonDataOption('appInsightsAppId')}
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
