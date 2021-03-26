import React from 'react';
import { HttpSettingsBaseProps } from './types';
import { DataSourceSettings, SelectableValue } from '@grafana/data';
import {
  AwsAuthDataSourceSecureJsonData,
  AwsAuthDataSourceJsonData,
  ConnectionConfig,
  ConnectionConfigProps,
} from '@grafana/aws-sdk';

export const SigV4AuthSettings: React.FC<HttpSettingsBaseProps> = (props) => {
  const { dataSourceConfig, onChange } = props;

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

  const connectionConfigProps: ConnectionConfigProps<AwsAuthDataSourceJsonData, AwsAuthDataSourceSecureJsonData> = {
    onOptionsChange: (awsDataSourceSettings) => {
      const dataSourceSettings: DataSourceSettings = {
        ...dataSourceConfig,
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
      <ConnectionConfig {...connectionConfigProps} standardRegions={regions.map((r) => r.value)}></ConnectionConfig>
    </>
  );
};
