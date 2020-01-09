import React, { PureComponent, ChangeEvent } from 'react';
import { FormLabel, Select, Input, Button } from '@grafana/ui';
import {
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetKeyOption,
  updateDatasourcePluginOption,
} from '@grafana/data';
import { SelectableValue } from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import CloudWatchDatasource from '../datasource';
import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../types';
import { CancelablePromise, makePromiseCancelable } from 'app/core/utils/CancelablePromise';

const authProviderOptions = [
  { label: 'Access & secret key', value: 'keys' },
  { label: 'Credentials file', value: 'credentials' },
  { label: 'ARN', value: 'arn' },
] as SelectableValue[];

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData, CloudWatchSecureJsonData>;

export interface State {
  regions: SelectableValue[];
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      regions: [],
    };
  }

  loadRegionsPromise: CancelablePromise<any> = null;

  componentDidMount() {
    this.loadRegionsPromise = makePromiseCancelable(this.loadRegions());
    this.loadRegionsPromise.promise.catch(({ isCanceled }) => {
      if (isCanceled) {
        console.warn('Cloud Watch ConfigEditor has unmounted, intialization was canceled');
      }
    });
  }

  componentWillUnmount() {
    if (this.loadRegionsPromise) {
      this.loadRegionsPromise.cancel();
    }
  }

  onUpdateOption = (key: string, val: any, secure: boolean) => {
    updateDatasourcePluginJsonDataOption(this.props, key, val, secure);
  };

  onResetKey = (key: string) => {
    updateDatasourcePluginResetKeyOption(this.props, key);
  };

  async loadRegions() {
    await getDatasourceSrv()
      .loadDatasource(this.props.options.name)
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

  onAuthProviderChange = (authType: SelectableValue<string>) => {
    this.onUpdateOption('authType', authType.value, false);
  };

  onRegionChange = (defaultRegion: SelectableValue<string>) => {
    this.onUpdateOption('defaultRegion', defaultRegion.value, false);
  };

  onResetAccessKey = () => {
    this.onResetKey('accessKey');
  };

  onAccessKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.onUpdateOption('accessKey', event.target.value, true);
  };

  onResetSecretKey = () => {
    this.onResetKey('secretKey');
  };

  onSecretKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.onUpdateOption('secretKey', event.target.value, true);
  };

  onCredentialProfileNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateDatasourcePluginOption(this.props, 'database', event.target.value);
  };

  onArnAssumeRoleChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.onUpdateOption('assumeRoleArn', event.target.value, false);
  };

  onCustomMetricsNamespacesChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.onUpdateOption('customMetricsNamespaces', event.target.value, false);
  };

  render() {
    const { regions } = this.state;
    const { options } = this.props;
    const secureJsonData = (options.secureJsonData || {}) as CloudWatchSecureJsonData;

    return (
      <>
        <h3 className="page-heading">CloudWatch Details</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-14">Auth Provider</FormLabel>
              <Select
                className="width-30"
                value={authProviderOptions.find(authProvider => authProvider.value === options.jsonData.authType)}
                options={authProviderOptions}
                defaultValue={options.jsonData.authType}
                onChange={this.onAuthProviderChange}
              />
            </div>
          </div>
          {options.jsonData.authType === 'credentials' && (
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
                    value={options.jsonData.database}
                    onChange={this.onCredentialProfileNameChange}
                  />
                </div>
              </div>
            </div>
          )}
          {options.jsonData.authType === 'keys' && (
            <div>
              {options.secureJsonFields.accessKey ? (
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
                        value={secureJsonData.accessKey || ''}
                        onChange={this.onAccessKeyChange}
                      />
                    </div>
                  </div>
                </div>
              )}
              {options.secureJsonFields.secretKey ? (
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
                        value={secureJsonData.secretKey || ''}
                        onChange={this.onSecretKeyChange}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {options.jsonData.authType === 'arn' && (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-14" tooltip="ARN of Assume Role">
                  Assume Role ARN
                </FormLabel>
                <div className="width-30">
                  <Input
                    className="width-30"
                    placeholder="arn:aws:iam:*"
                    value={options.jsonData.assumeRoleArn || ''}
                    onChange={this.onArnAssumeRoleChange}
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
                value={regions.find(region => region.value === options.jsonData.defaultRegion)}
                options={regions}
                defaultValue={options.jsonData.defaultRegion}
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
                value={options.jsonData.customMetricsNamespaces || ''}
                onChange={this.onCustomMetricsNamespacesChange}
              />
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default ConfigEditor;
