import React, { PureComponent } from 'react';
import { FormLabel, Button, Input } from '@grafana/ui';

export interface Props {
  datasourceConfig: any;
  onDatasourceUpdate: (config: any) => void;
}

export interface State {
  config: any;
}

export class InsightsConfig extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { datasourceConfig } = this.props;

    this.state = {
      config: datasourceConfig,
    };
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: props.datasourceConfig,
    };
  }

  onAppInsightsAppIdChange = (appInsightsAppId: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        appInsightsAppId,
      },
    });
  };

  onAppInsightsApiKeyChange = (appInsightsApiKey: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        appInsightsApiKey,
      },
    });
  };

  onAppInsightsResetApiKey = () => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      version: this.state.config.version + 1,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        appInsightsApiKey: false,
      },
    });
  };

  render() {
    const { config } = this.state;
    return (
      <>
        <h3 className="page-heading">Application Insights Details</h3>
        <div className="gf-form-group">
          {config.secureJsonFields.appInsightsApiKey ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-12">API Key</FormLabel>
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
                <FormLabel className="width-12">API Key</FormLabel>
                <div className="width-15">
                  <Input
                    className="width-30"
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    value={config.secureJsonData.appInsightsApiKey || ''}
                    onChange={event => this.onAppInsightsApiKeyChange(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-12">Application ID</FormLabel>
              <div className="width-15">
                <Input
                  className="width-30"
                  value={config.jsonData.appInsightsAppId || ''}
                  onChange={event => this.onAppInsightsAppIdChange(event.target.value)}
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
