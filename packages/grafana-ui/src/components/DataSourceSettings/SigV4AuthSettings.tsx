import React, { useEffect } from 'react';
import { HttpSettingsBaseProps } from './types';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings, SelectableValue } from '@grafana/data';
import { AwsAuthDataSourceSecureJsonData, AwsAuthDataSourceJsonData, ConnectionConfig } from '@grafana/aws-sdk';

import { Button, InlineFormLabel, Input } from '..';
import Select from '../Forms/Legacy/Select/Select';

export const SigV4AuthSettings: React.FC<HttpSettingsBaseProps> = (props) => {
  const { dataSourceConfig, onChange } = props;

  const authProviderOptions = [
    { label: 'AWS SDK Default', value: 'default' },
    { label: 'Access & secret key', value: 'keys' },
    { label: 'Credentials file', value: 'credentials' },
  ] as SelectableValue[];

  const regions = [
    { value: 'af-south-1', label: 'af-south-1' },
    { value: 'ap-east-1', label: 'ap-east-1' },
    { value: 'ap-northeast-1', label: 'ap-northeast-1' },
    { value: 'ap-northeast-2', label: 'ap-northeast-2' },
    { value: 'ap-northeast-3', label: 'ap-northeast-3' },
    { value: 'ap-south-1', label: 'ap-south-1' },
    { value: 'ap-southeast-1', label: 'ap-southeast-1' },
    { value: 'ap-southeast-2', label: 'ap-southeast-2' },
    { value: 'ca-central-1', label: 'ca-central-1' },
    { value: 'cn-north-1', label: 'cn-north-1' },
    { value: 'cn-northwest-1', label: 'cn-northwest-1' },
    { value: 'eu-central-1', label: 'eu-central-1' },
    { value: 'eu-north-1', label: 'eu-north-1' },
    { value: 'eu-west-1', label: 'eu-west-1' },
    { value: 'eu-west-2', label: 'eu-west-2' },
    { value: 'eu-west-3', label: 'eu-west-3' },
    { value: 'me-south-1', label: 'me-south-1' },
    { value: 'sa-east-1', label: 'sa-east-1' },
    { value: 'us-east-1', label: 'us-east-1' },
    { value: 'us-east-2', label: 'us-east-2' },
    { value: 'us-gov-east-1', label: 'us-gov-east-1' },
    { value: 'us-gov-west-1', label: 'us-gov-west-1' },
    { value: 'us-iso-east-1', label: 'us-iso-east-1' },
    { value: 'us-isob-east-1', label: 'us-isob-east-1' },
    { value: 'us-west-1', label: 'us-west-1' },
    { value: 'us-west-2', label: 'us-west-2' },
  ] as SelectableValue[];

  // Apply some defaults on initial render
  useEffect(() => {
    const sigV4AuthType = dataSourceConfig.jsonData.sigV4AuthType || 'default';
    onJsonDataChange('sigV4AuthType', sigV4AuthType);
    // We can't enforce the eslint rule here because we only want to run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSecureJsonDataReset = (fieldName: string) => {
    const state = {
      ...dataSourceConfig,
      secureJsonData: {
        ...dataSourceConfig.secureJsonData,
        [fieldName]: '',
      },
      secureJsonFields: {
        ...dataSourceConfig.secureJsonFields,
        [fieldName]: false,
      },
    };

    onChange(state);
  };

  const onSecureJsonDataChange = (fieldName: string, fieldValue: string) => {
    const state = {
      ...dataSourceConfig,
      secureJsonData: {
        ...dataSourceConfig.secureJsonData,
        [fieldName]: fieldValue,
      },
    };

    onChange(state);
  };

  const onJsonDataChange = (fieldName: string, fieldValue: string) => {
    const state = {
      ...dataSourceConfig,
      jsonData: {
        ...dataSourceConfig.jsonData,
        [fieldName]: fieldValue,
      },
    };

    onChange(state);
  };

  const connectionConfigProps: DataSourcePluginOptionsEditorProps<
    AwsAuthDataSourceJsonData,
    AwsAuthDataSourceSecureJsonData
  > = {
    onOptionsChange: (
      awsDataSourceSettings: DataSourceSettings<AwsAuthDataSourceJsonData, AwsAuthDataSourceSecureJsonData>
    ) => {
      const dataSourceSettings: DataSourceSettings = {
        ...awsDataSourceSettings,
        jsonData: {
          ...awsDataSourceSettings.jsonData,
          sigV4AuthType: awsDataSourceSettings.jsonData.authType,
          sigV4Profile: awsDataSourceSettings.jsonData.profile,
          sigV4AssumeRoleArn: awsDataSourceSettings.jsonData.assumeRoleArn,
          sigV4ExternalId: awsDataSourceSettings.jsonData.externalId,
          sigV4Region: awsDataSourceSettings.jsonData.defaultRegion,
          sigV4Endpoint: awsDataSourceSettings.jsonData.endpoint,
        } as any, // sigV4 jsonData fields are not typed
        secureJsonFields: {
          sigV4AccessKey: awsDataSourceSettings.secureJsonFields?.accessKey,
          sigV4SecretKey: awsDataSourceSettings.secureJsonFields?.secretKey,
        },
        secureJsonData: {
          sigV4AccessKey: awsDataSourceSettings.secureJsonData?.accessKey,
          sigV4SecretKey: awsDataSourceSettings.secureJsonData?.secretKey,
        },
      };
      onChange(dataSourceSettings);
    },
    options: {
      ...dataSourceConfig,
      jsonData: {
        ...dataSourceConfig.jsonData,
        authType: dataSourceConfig.jsonData.sigV4AuthType,
        profile: dataSourceConfig.jsonData.sigV4Profile,
        assumeRoleArn: dataSourceConfig.jsonData.sigV4AssumeRoleArn,
        externalId: dataSourceConfig.jsonData.sigV4ExternalId,
        defaultRegion: dataSourceConfig.jsonData.sigV4Region,
        endpoint: dataSourceConfig.jsonData.sigV4Endpoint,
      },
      secureJsonFields: {
        accessKey: dataSourceConfig.secureJsonFields?.sigV4AccessKey,
        secretKey: dataSourceConfig.secureJsonFields?.sigV4SecretKey,
      },
      secureJsonData: {
        accessKey: dataSourceConfig.secureJsonData?.sigV4AccessKey,
        secretKey: dataSourceConfig.secureJsonData?.sigV4SecretKey,
      },
    },
  };

  return (
    <>
      <h6>SigV4 Auth Details</h6>
      <ConnectionConfig {...(connectionConfigProps as any)}></ConnectionConfig>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              className="width-14"
              tooltip="Which AWS credentials chain to use. AWS SDK Default is the recommended option for EKS, ECS, or if you've attached an IAM role to your EC2 instance."
            >
              Authentication Provider
            </InlineFormLabel>
            <Select
              className="width-30"
              value={authProviderOptions.find(
                (authProvider) => authProvider.value === dataSourceConfig.jsonData.sigV4AuthType
              )}
              options={authProviderOptions}
              defaultValue={dataSourceConfig.jsonData.sigV4AuthType || ''}
              onChange={(option) => {
                onJsonDataChange('sigV4AuthType', option.value);
              }}
            />
          </div>
        </div>
        {dataSourceConfig.jsonData.sigV4AuthType === 'credentials' && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel
                className="width-14"
                tooltip="Credentials profile name, as specified in ~/.aws/credentials, leave blank for default."
              >
                Credentials Profile Name
              </InlineFormLabel>
              <div className="width-30">
                <Input
                  className="width-30"
                  placeholder="default"
                  value={dataSourceConfig.jsonData.sigV4Profile || ''}
                  onChange={(e) => onJsonDataChange('sigV4Profile', e.currentTarget.value)}
                />
              </div>
            </div>
          </div>
        )}
        {dataSourceConfig.jsonData.sigV4AuthType === 'keys' && (
          <div>
            {dataSourceConfig.secureJsonFields?.sigV4AccessKey ? (
              <div className="gf-form-inline">
                <div className="gf-form">
                  <InlineFormLabel className="width-14">Access Key ID</InlineFormLabel>
                  <Input className="width-25" placeholder="Configured" disabled={true} />
                </div>
                <div className="gf-form">
                  <div className="max-width-30 gf-form-inline">
                    <Button variant="secondary" type="button" onClick={(e) => onSecureJsonDataReset('sigV4AccessKey')}>
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gf-form-inline">
                <div className="gf-form">
                  <InlineFormLabel className="width-14">Access Key ID</InlineFormLabel>
                  <div className="width-30">
                    <Input
                      className="width-30"
                      value={dataSourceConfig.secureJsonData?.sigV4AccessKey || ''}
                      onChange={(e) => onSecureJsonDataChange('sigV4AccessKey', e.currentTarget.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            {dataSourceConfig.secureJsonFields?.sigV4SecretKey ? (
              <div className="gf-form-inline">
                <div className="gf-form">
                  <InlineFormLabel className="width-14">Secret Access Key</InlineFormLabel>
                  <Input className="width-25" placeholder="Configured" disabled={true} />
                </div>
                <div className="gf-form">
                  <div className="max-width-30 gf-form-inline">
                    <Button variant="secondary" type="button" onClick={(e) => onSecureJsonDataReset('sigV4SecretKey')}>
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gf-form-inline">
                <div className="gf-form">
                  <InlineFormLabel className="width-14">Secret Access Key</InlineFormLabel>
                  <div className="width-30">
                    <Input
                      className="width-30"
                      value={dataSourceConfig.secureJsonData?.sigV4SecretKey || ''}
                      onChange={(e) => onSecureJsonDataChange('sigV4SecretKey', e.currentTarget.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              className="width-14"
              tooltip="ARN of the role to assume. Specifying a role here ensures that the selected authentication provider is used to assume the role rather than using the credentials directly. Leave blank if you don't need to assume a role."
            >
              Assume Role ARN
            </InlineFormLabel>
            <div className="width-30">
              <Input
                className="width-30"
                placeholder="arn:aws:iam:*"
                value={dataSourceConfig.jsonData.sigV4AssumeRoleArn || ''}
                onChange={(e) => onJsonDataChange('sigV4AssumeRoleArn', e.currentTarget.value)}
              />
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel
                className="width-14"
                tooltip="If you are assuming a role in another account, that was created with an external ID, specify the external ID here."
              >
                External ID
              </InlineFormLabel>
              <div className="width-30">
                <Input
                  className="width-30"
                  placeholder="External ID"
                  value={dataSourceConfig.jsonData.sigV4ExternalId || ''}
                  onChange={(e) => onJsonDataChange('sigV4ExternalId', e.currentTarget.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              className="width-14"
              tooltip="Specify the region, for example, use ` us-west-2 ` for US West (Oregon)."
            >
              Default Region
            </InlineFormLabel>
            <Select
              className="width-30"
              value={regions.find((region) => region.value === dataSourceConfig.jsonData.sigV4Region)}
              options={regions}
              defaultValue={dataSourceConfig.jsonData.sigV4Region || ''}
              onChange={(option) => onJsonDataChange('sigV4Region', option.value)}
            />
          </div>
        </div>
      </div>
    </>
  );
};
