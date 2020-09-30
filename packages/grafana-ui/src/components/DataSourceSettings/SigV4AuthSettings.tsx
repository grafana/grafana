import React from 'react';
import { HttpSettingsProps } from './types';
import { SelectableValue } from '@grafana/data';
import { Button, InlineFormLabel, Input } from '..';
import Select from '../Forms/Legacy/Select/Select';

export const SigV4AuthSettings: React.FC<HttpSettingsProps> = props => {
  const { dataSourceConfig } = props;

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

    props.onChange(state);
  };

  const onSecureJsonDataChange = (fieldName: string, fieldValue: string) => {
    const state = {
      ...dataSourceConfig,
      secureJsonData: {
        ...dataSourceConfig.secureJsonData,
        [fieldName]: fieldValue,
      },
    };

    props.onChange(state);
  };

  const onJsonDataChange = (fieldName: string, fieldValue: string) => {
    const state = {
      ...dataSourceConfig,
      jsonData: {
        ...dataSourceConfig.jsonData,
        [fieldName]: fieldValue,
      },
    };

    props.onChange(state);
  };

  return (
    <>
      <h3 className="page-heading">Sigv4 Details</h3>
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
                authProvider => authProvider.value === dataSourceConfig.jsonData.authType
              )}
              options={authProviderOptions}
              defaultValue={dataSourceConfig.jsonData.authType || 'keys'}
              onChange={option => {
                if (dataSourceConfig.jsonData.authType === 'arn' && option.value !== 'arn') {
                  delete dataSourceConfig.jsonData.assumeRoleArn;
                  delete dataSourceConfig.jsonData.externalId;
                }
                onJsonDataChange('authType', option.value);
              }}
            />
          </div>
        </div>
        {dataSourceConfig.jsonData.authType === 'credentials' && (
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
                  value={dataSourceConfig.jsonData.profile || ''}
                  onChange={e => onJsonDataChange('profile', e.currentTarget.value)}
                />
              </div>
            </div>
          </div>
        )}
        {dataSourceConfig.jsonData.authType === 'keys' && (
          <div>
            {dataSourceConfig.secureJsonFields?.accessKey ? (
              <div className="gf-form-inline">
                <div className="gf-form">
                  <InlineFormLabel className="width-14">Access Key ID</InlineFormLabel>
                  <Input className="width-25" placeholder="Configured" disabled={true} />
                </div>
                <div className="gf-form">
                  <div className="max-width-30 gf-form-inline">
                    <Button variant="secondary" type="button" onClick={e => onSecureJsonDataReset('accessKey')}>
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
                      value={dataSourceConfig.secureJsonData?.accessKey || ''}
                      onChange={e => onSecureJsonDataChange('accessKey', e.currentTarget.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            {dataSourceConfig.secureJsonFields?.secretKey ? (
              <div className="gf-form-inline">
                <div className="gf-form">
                  <InlineFormLabel className="width-14">Secret Access Key</InlineFormLabel>
                  <Input className="width-25" placeholder="Configured" disabled={true} />
                </div>
                <div className="gf-form">
                  <div className="max-width-30 gf-form-inline">
                    <Button variant="secondary" type="button" onClick={e => onSecureJsonDataReset('secretKey')}>
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
                      value={dataSourceConfig.secureJsonData?.secretKey || ''}
                      onChange={e => onSecureJsonDataChange('secretKey', e.currentTarget.value)}
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
                value={dataSourceConfig.jsonData.assumeRoleArn || ''}
                onChange={e => onJsonDataChange('assumeRoleArn', e.currentTarget.value)}
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
                  value={dataSourceConfig.jsonData.externalId || ''}
                  onChange={e => onJsonDataChange('externalId', e.currentTarget.value)}
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
              value={regions.find(region => region.value === dataSourceConfig.jsonData.region)}
              options={regions}
              defaultValue={dataSourceConfig.jsonData.region || ''}
              onChange={option => onJsonDataChange('region', option.value)}
            />
          </div>
        </div>
      </div>
    </>
  );
};
