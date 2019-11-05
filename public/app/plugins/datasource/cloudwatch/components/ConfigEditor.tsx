import React, { PureComponent, ChangeEvent } from 'react';
import { FormLabel, Select, Input, Button } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { SelectableValue } from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import CloudWatchDatasource from '../datasource';
import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../types';

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData>;

type CloudwatchSettings = DataSourceSettings<CloudWatchJsonData, CloudWatchSecureJsonData>;

export interface State {
  config: CloudwatchSettings;
  authProviderOptions: SelectableValue[];
  regions: SelectableValue[];
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { options } = this.props;

    this.state = {
      config: ConfigEditor.defaults(options),
      authProviderOptions: [
        { label: 'Access & secret key', value: 'keys' },
        { label: 'Credentials file', value: 'credentials' },
        { label: 'ARN', value: 'arn' },
      ],
      regions: [],
    };

    this.updateDatasource(this.state.config);
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: ConfigEditor.defaults(props.options),
    };
  }

  static defaults = (options: any) => {
    options.jsonData.authType = options.jsonData.authType || 'credentials';
    options.jsonData.timeField = options.jsonData.timeField || '@timestamp';

    if (!options.hasOwnProperty('secureJsonData')) {
      options.secureJsonData = {};
    }

    if (!options.hasOwnProperty('jsonData')) {
      options.jsonData = {};
    }

    if (!options.hasOwnProperty('secureJsonFields')) {
      options.secureJsonFields = {};
    }

    return options;
  };

  async componentDidMount() {
    this.loadRegions();
  }

  loadRegions() {
    getDatasourceSrv()
      .loadDatasource(this.state.config.name)
      .then((ds: CloudWatchDatasource) => {
        return ds.getRegions();
      })
      .then(
        (regions: any) => {
          this.setState({
            regions: regions.map((region: any) => {
              return {
                value: region.value,
                label: region.text,
              };
            }),
          });
        },
        (err: any) => {
          const regions = [
            'ap-east-1',
            'ap-northeast-1',
            'ap-northeast-2',
            'ap-northeast-3',
            'ap-south-1',
            'ap-southeast-1',
            'ap-southeast-2',
            'ca-central-1',
            'cn-north-1',
            'cn-northwest-1',
            'eu-central-1',
            'eu-north-1',
            'eu-west-1',
            'eu-west-2',
            'eu-west-3',
            'me-south-1',
            'sa-east-1',
            'us-east-1',
            'us-east-2',
            'us-gov-east-1',
            'us-gov-west-1',
            'us-iso-east-1',
            'us-isob-east-1',
            'us-west-1',
            'us-west-2',
          ];

          this.setState({
            regions: regions.map((region: string) => {
              return {
                value: region,
                label: region,
              };
            }),
          });

          // expected to fail when creating new datasource
          // console.error('failed to get latest regions', err);
        }
      );
  }

  updateDatasource = async (config: any) => {
    for (const j in config.jsonData) {
      if (config.jsonData[j].length === 0) {
        delete config.jsonData[j];
      }
    }

    for (const k in config.secureJsonData) {
      if (config.secureJsonData[k].length === 0) {
        delete config.secureJsonData[k];
      }
    }

    this.props.onOptionsChange({
      ...config,
    });
  };

  onAuthProviderChange = (authType: SelectableValue<string>) => {
    this.updateDatasource({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        authType: authType.value,
      },
    });
  };

  onRegionChange = (defaultRegion: SelectableValue<string>) => {
    this.updateDatasource({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        defaultRegion: defaultRegion.value,
      },
    });
  };

  onResetAccessKey = () => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        accessKey: false,
      },
    });
  };

  onAccessKeyChange = (accessKey: string) => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        accessKey,
      },
    });
  };

  onResetSecretKey = () => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        secretKey: false,
      },
    });
  };

  onSecretKeyChange = (secretKey: string) => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        secretKey,
      },
    });
  };

  onCredentialProfileNameChange = (database: string) => {
    this.updateDatasource({
      ...this.state.config,
      database,
    });
  };

  onArnAssumeRoleChange = (assumeRoleArn: string) => {
    this.updateDatasource({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        assumeRoleArn,
      },
    });
  };

  onCustomMetricsNamespacesChange = (customMetricsNamespaces: string) => {
    this.updateDatasource({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        customMetricsNamespaces,
      },
    });
  };

  render() {
    const { config, authProviderOptions, regions } = this.state;

    return (
      <>
        <h3 className="page-heading">CloudWatch Details</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-14">Auth Provider</FormLabel>
              <Select
                className="width-30"
                value={authProviderOptions.find(authProvider => authProvider.value === config.jsonData.authType)}
                options={authProviderOptions}
                defaultValue={config.jsonData.authType}
                onChange={this.onAuthProviderChange}
              />
            </div>
          </div>
          {config.jsonData.authType === 'credentials' && (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel
                  className="width-14"
                  tooltip="Credentials profile name, as specified in ~/.aws/credentials, leave blank for default."
                >
                  Credentials Profile Name
                </FormLabel>
                <div className="width-30">
                  <Input
                    className="width-30"
                    placeholder="default"
                    value={config.jsonData.database}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      this.onCredentialProfileNameChange(event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )}
          {config.jsonData.authType === 'keys' && (
            <div>
              {config.secureJsonFields.accessKey ? (
                <div className="gf-form-inline">
                  <div className="gf-form">
                    <FormLabel className="width-14">Access Key ID</FormLabel>
                    <Input className="width-25" placeholder="Configured" disabled={true} />
                  </div>
                  <div className="gf-form">
                    <div className="max-width-30 gf-form-inline">
                      <Button variant="secondary" type="button" onClick={this.onResetAccessKey}>
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="gf-form-inline">
                  <div className="gf-form">
                    <FormLabel className="width-14">Access Key ID</FormLabel>
                    <div className="width-30">
                      <Input
                        className="width-30"
                        value={config.secureJsonData.accessKey || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => this.onAccessKeyChange(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
              {config.secureJsonFields.secretKey ? (
                <div className="gf-form-inline">
                  <div className="gf-form">
                    <FormLabel className="width-14">Secret Access Key</FormLabel>
                    <Input className="width-25" placeholder="Configured" disabled={true} />
                  </div>
                  <div className="gf-form">
                    <div className="max-width-30 gf-form-inline">
                      <Button variant="secondary" type="button" onClick={this.onResetSecretKey}>
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="gf-form-inline">
                  <div className="gf-form">
                    <FormLabel className="width-14">Secret Access Key</FormLabel>
                    <div className="width-30">
                      <Input
                        className="width-30"
                        value={config.secureJsonData.secretKey || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => this.onSecretKeyChange(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {config.jsonData.authType === 'arn' && (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-14" tooltip="ARN of Assume Role">
                  Assume Role ARN
                </FormLabel>
                <div className="width-30">
                  <Input
                    className="width-30"
                    placeholder="arn:aws:iam:*"
                    value={config.jsonData.assumeRoleArn || ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => this.onArnAssumeRoleChange(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel
                className="width-14"
                tooltip="Specify the region, such as for US West (Oregon) use ` us-west-2 ` as the region."
              >
                Default Region
              </FormLabel>
              <Select
                className="width-30"
                value={regions.find(region => region.value === config.jsonData.defaultRegion)}
                options={regions}
                defaultValue={config.jsonData.defaultRegion}
                onChange={this.onRegionChange}
              />
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-14" tooltip="Namespaces of Custom Metrics.">
                Custom Metrics
              </FormLabel>
              <Input
                className="width-30"
                placeholder="Namespace1,Namespace2"
                value={config.jsonData.customMetricsNamespaces || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  this.onCustomMetricsNamespacesChange(event.target.value)
                }
              />
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default ConfigEditor;
