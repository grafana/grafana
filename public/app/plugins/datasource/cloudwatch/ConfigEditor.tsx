import React, { PureComponent, ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps, FormLabel, Select, Input, Button } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import DatasourceSrv, { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import CloudWatchDatasource from './datasource';

export type Props = DataSourcePluginOptionsEditorProps<any>;

export interface State {
  config: any;
  authProviderOptions: SelectableValue[];
  regions: SelectableValue[];
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { options } = this.props;

    this.state = {
      config: ConfigEditor.keyFill(options),
      authProviderOptions: [
        { label: 'Access & secret key', value: 'keys' },
        { label: 'Credentials file', value: 'credentials' },
        { label: 'ARN', value: 'arn' },
      ],
      regions: [],
    };

    this.datasourceSrv = getDatasourceSrv();

    this.updateDatasource(this.state.config);

    this.getRegions();
  }

  datasourceSrv: DatasourceSrv = null;

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: ConfigEditor.keyFill(props.options),
    };
  }

  static keyFill = (options: any) => {
    options.jsonData.authType = options.jsonData.authType || 'credentials';
    options.jsonData.timeField = options.jsonData.timeField || '@timestamp';

    if (!options.hasOwnProperty('editorSecureJsonData')) {
      options.editorSecureJsonData = {
        accessKey: '',
        secretKey: '',
      };
    }

    if (!options.hasOwnProperty('editorJsonData')) {
      options.editorJsonData = {
        assumeRoleArn: '',
        customMetricsNamespaces: '',
      };
    }

    if (!options.hasOwnProperty('secureJsonFields')) {
      options.secureJsonFields = {
        accessKey: false,
        secretKey: false,
      };
    }

    return options;
  };

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

    for (const m in config.editorJsonData) {
      if (!config.hasOwnProperty('jsonData')) {
        config.jsonData = {};
      }
      if (config.editorJsonData[m].length === 0) {
        if (config.hasOwnProperty('jsonData') && config.jsonData.hasOwnProperty(m)) {
          delete config.jsonData[m];
        }
      } else {
        config.jsonData[m] = config.editorJsonData[m];
      }
    }

    for (const k in config.secureJsonData) {
      if (config.secureJsonData[k].length === 0) {
        delete config.secureJsonData[k];
      }
    }

    for (const l in config.editorSecureJsonData) {
      if (!config.hasOwnProperty('secureJsonData')) {
        config.secureJsonData = {};
      }
      if (config.editorSecureJsonData[l].length === 0) {
        if (config.hasOwnProperty('secureJsonData') && config.secureJsonData.hasOwnProperty(l)) {
          delete config.secureJsonData[l];
        }
      } else {
        config.secureJsonData[l] = config.editorSecureJsonData[l];
      }
    }

    this.props.onOptionsChange({
      ...config,
    });
  };

  onAuthProviderChange = (authType: SelectableValue<string>) => {
    this.updateDatasource({
      ...this.state.config,
      editorJsonData: {
        ...this.state.config.editorJsonData,
        authType: authType.value,
      },
    });
  };

  onRegionChange = (defaultRegion: SelectableValue<string>) => {
    this.updateDatasource({
      ...this.state.config,
      editorJsonData: {
        ...this.state.config.editorJsonData,
        defaultRegion: defaultRegion.value,
      },
    });
  };

  onResetAccessKey = () => {
    this.updateDatasource({
      ...this.state.config,
      version: this.state.config.version + 1,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        accessKey: false,
      },
    });
  };

  onAccessKeyChange = (accessKey: string) => {
    this.updateDatasource({
      ...this.state.config,
      editorSecureJsonData: {
        ...this.state.config.editorSecureJsonData,
        accessKey,
      },
    });
  };

  onResetSecretKey = () => {
    this.updateDatasource({
      ...this.state.config,
      version: this.state.config.version + 1,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        secretKey: false,
      },
    });
  };

  onSecretKeyChange = (secretKey: string) => {
    this.updateDatasource({
      ...this.state.config,
      editorSecureJsonData: {
        ...this.state.config.editorSecureJsonData,
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
      editorJsonData: {
        ...this.state.config.editorJsonData,
        assumeRoleArn,
      },
    });
  };

  onCustomMetricsNamespacesChange = (customMetricsNamespaces: string) => {
    this.updateDatasource({
      ...this.state.config,
      editorJsonData: {
        ...this.state.config.editorJsonData,
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
              <FormLabel className="width-14" tooltip="Choose an Azure Cloud.">
                Auth Provider
              </FormLabel>
              <Select
                className="width-15"
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
                <div className="width-15">
                  <Input
                    className="width-30"
                    placeholder="default"
                    value={config.editorJsonData.database}
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
                    <div className="width-15">
                      <Input
                        className="width-30"
                        value={config.editorSecureJsonData.accessKey}
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
                    <div className="width-15">
                      <Input
                        className="width-30"
                        value={config.editorSecureJsonData.secretKey}
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
                <div className="width-15">
                  <Input
                    className="width-30"
                    placeholder="arn:aws:iam:*"
                    value={config.editorJsonData.assumeRoleArn}
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
                className="width-15"
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
                value={config.editorJsonData.customMetricsNamespaces}
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
