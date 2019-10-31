import React, { PureComponent, ChangeEvent } from 'react';
import { FormLabel, Select, Input, Button } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { SelectableValue } from '@grafana/data';
import DatasourceSrv, { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import CloudWatchDatasource from '../datasource';
import { CloudWatchOptions } from '../types';

export type Props = DataSourcePluginOptionsEditorProps<any>;

export type CloudwatchSettings = DataSourceSettings<CloudWatchOptions>;

export interface State {
  config: CloudWatchOptions;
  authProviderOptions: SelectableValue[];
  regions: SelectableValue[];
}

export class ConfigEditor extends PureComponent<Props, State> {
  datasourceSrv: DatasourceSrv = null;

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

    this.datasourceSrv = getDatasourceSrv();

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

  componentDidMount() {
    this.getRegions();
  }

  getRegions() {
    this.datasourceSrv
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
          console.error('failed to get latest regions');
        }
      );
  }

  updateDatasource = async (config: any) => {
    for (const j in config.jsonData) {
      if (config.jsonData[j].length === 0) {
        delete config.jsonData[j];
      }
    }

    for (const m in config.jsonData) {
      if (!config.hasOwnProperty('jsonData')) {
        config.jsonData = {};
      }
      if (config.jsonData[m].length === 0) {
        if (config.hasOwnProperty('jsonData') && config.jsonData.hasOwnProperty(m)) {
          delete config.jsonData[m];
        }
      } else {
        config.jsonData[m] = config.jsonData[m];
      }
    }

    for (const k in config.secureJsonData) {
      if (config.secureJsonData[k].length === 0) {
        delete config.secureJsonData[k];
      }
    }

    for (const l in config.secureJsonData) {
      if (!config.hasOwnProperty('secureJsonData')) {
        config.secureJsonData = {};
      }
      if (config.secureJsonData[l].length === 0) {
        if (config.hasOwnProperty('secureJsonData') && config.secureJsonData.hasOwnProperty(l)) {
          delete config.secureJsonData[l];
        }
      } else {
        config.secureJsonData[l] = config.secureJsonData[l];
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
