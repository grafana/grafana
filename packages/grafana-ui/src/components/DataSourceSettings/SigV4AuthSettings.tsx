import React from 'react';

import {
  AwsAuthDataSourceSecureJsonData,
  AwsAuthDataSourceJsonData,
  ConnectionConfig,
  ConnectionConfigProps,
} from '@grafana/aws-sdk';
import { DataSourceSettings } from '@grafana/data';

import { HttpSettingsBaseProps } from './types';

export const SigV4AuthSettings: React.FC<HttpSettingsBaseProps> = (props) => {
  const { dataSourceConfig, onChange } = props;

  // The @grafana/aws-sdk ConnectionConfig is designed to be rendered in a ConfigEditor,
  // taking DataSourcePluginOptionsEditorProps as props. We therefore need to map the props accordingly.
  const connectionConfigProps: ConnectionConfigProps<AwsAuthDataSourceJsonData, AwsAuthDataSourceSecureJsonData> = {
    onOptionsChange: (awsDataSourceSettings) => {
      const dataSourceSettings: DataSourceSettings<any, any> = {
        ...dataSourceConfig,
        jsonData: {
          ...dataSourceConfig.jsonData,
          sigV4AuthType: awsDataSourceSettings.jsonData.authType,
          sigV4Profile: awsDataSourceSettings.jsonData.profile,
          sigV4AssumeRoleArn: awsDataSourceSettings.jsonData.assumeRoleArn,
          sigV4ExternalId: awsDataSourceSettings.jsonData.externalId,
          sigV4Region: awsDataSourceSettings.jsonData.defaultRegion,
          sigV4Endpoint: awsDataSourceSettings.jsonData.endpoint,
        },
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
      <div className="gf-form">
        <h6>SigV4 Auth Details</h6>
      </div>
      <ConnectionConfig {...connectionConfigProps} skipHeader skipEndpoint></ConnectionConfig>
    </>
  );
};
