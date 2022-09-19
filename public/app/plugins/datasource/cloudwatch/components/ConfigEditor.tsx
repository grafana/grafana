import React, { FC } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceResetOption,
  onUpdateDatasourceSecureJsonDataOption,
  toOption,
} from '@grafana/data';
import { Input, InlineField, ButtonGroup, FieldSet, Select, ToolbarButton } from '@grafana/ui';

import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../types';

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData, CloudWatchSecureJsonData>;

export const ConfigEditor: FC<Props> = (props: Props) => {
  const regions: string[] = [
    'af-south-1',
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

  const { options } = props;
  console.log(props.formApi);

  return (
    <FieldSet label={'Connection Details'} data-testid="connection-config">
      <InlineField
        label="Authentication Provider"
        labelWidth={28}
        tooltip="Specify which AWS credentials chain to use."
        required
      >
        <Select
          aria-label="Authentication Provider"
          className="width-30"
          value={'keys'}
          options={[{ value: 'keys', label: 'Secret & keys' }]}
          defaultValue={options.jsonData.authType}
          onChange={(option) => {
            onUpdateDatasourceJsonDataOptionSelect(props, 'authType')(option);
          }}
          menuShouldPortal={true}
        />
      </InlineField>

      <>
        <InlineField
          label="Access Key ID"
          labelWidth={28}
          required
          invalid={props.formApi?.errors.accessKey}
          error={props.formApi?.errors.accessKey && props.formApi?.errors.accessKey.message}
        >
          {props.options.secureJsonFields?.accessKey ? (
            <ButtonGroup className="width-30">
              <Input disabled placeholder="Configured" />
              <ToolbarButton
                icon="edit"
                tooltip="Edit Access Key ID"
                type="button"
                onClick={onUpdateDatasourceResetOption(props as any, 'accessKey')}
              />
            </ButtonGroup>
          ) : (
            <Input
              {...props.formApi?.register('accessKey', { required: 'Access key is required' })}
              aria-label="Access Key ID"
              className="twidth-30"
              value={options.secureJsonData?.accessKey ?? ''}
              onChange={onUpdateDatasourceSecureJsonDataOption(props, 'accessKey')}
            />
          )}
        </InlineField>

        <InlineField
          label="Secret Access Key"
          labelWidth={28}
          required
          invalid={props.formApi?.errors.secretKey}
          error={props.formApi?.errors.secretKey && props.formApi?.errors.secretKey.message}
        >
          {props.options.secureJsonFields?.secretKey ? (
            <ButtonGroup className="width-30">
              <Input disabled placeholder="Configured" />
              <ToolbarButton
                icon="edit"
                type="button"
                tooltip="Edit Secret Access Key"
                onClick={onUpdateDatasourceResetOption(props as any, 'secretKey')}
              />
            </ButtonGroup>
          ) : (
            <Input
              {...props.formApi?.register('secretKey', { required: 'Secret key is required' })}
              aria-label="Secret Access Key"
              className="width-30"
              value={options.secureJsonData?.secretKey ?? ''}
              onChange={onUpdateDatasourceSecureJsonDataOption(props, 'secretKey')}
            />
          )}
        </InlineField>

        <InlineField
          label="Assume Role ARN"
          labelWidth={28}
          tooltip="Optionally, specify the ARN of a role to assume. Specifying a role here will ensure that the selected authentication provider is used to assume the specified role rather than using the credentials directly. Leave blank if you don't need to assume a role at all"
        >
          <Input
            aria-label="Assume Role ARN"
            className="width-30"
            placeholder="arn:aws:iam:*"
            value={options.jsonData.assumeRoleArn || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'assumeRoleArn')}
          />
        </InlineField>
        <InlineField
          label="External ID"
          labelWidth={28}
          tooltip="If you are assuming a role in another account, that has been created with an external ID, specify the external ID here."
        >
          <Input
            aria-label="External ID"
            className="width-30"
            placeholder="External ID"
            value={options.jsonData.externalId || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'externalId')}
          />
        </InlineField>
        <InlineField label="Endpoint" labelWidth={28} tooltip="Optionally, specify a custom endpoint for the service">
          <Input
            aria-label="Endpoint"
            className="width-30"
            placeholder={'https://{service}.{region}.amazonaws.com'}
            value={options.jsonData.endpoint || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'endpoint')}
          />
        </InlineField>
        <InlineField
          required
          label="Default Region"
          labelWidth={28}
          tooltip="Specify the region, such as for US West (Oregon) use ` us-west-2 ` as the region."
          invalid={props.formApi?.errors.region}
          error={props.formApi?.errors.region && props.formApi?.errors.region.message}
        >
          <Select
            {...props.formApi?.register('region', {
              required: 'You need to specify a region.',
              validate: async (v: any) => v,
            })}
            aria-label="Default Region"
            className="width-30"
            value={regions.map(toOption).find((region) => region.value === options.jsonData.defaultRegion)}
            options={regions.map(toOption)}
            defaultValue={options.jsonData.defaultRegion}
            allowCustomValue={true}
            onChange={onUpdateDatasourceJsonDataOptionSelect(props, 'defaultRegion')}
            formatCreateLabel={(r) => `Use region: ${r}`}
            menuShouldPortal={true}
          />
        </InlineField>
      </>
    </FieldSet>
  );
};
