import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

import {
  trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField,
  trackInfluxDBConfigV2FluxDBDetailsOrgInputField,
  trackInfluxDBConfigV2FluxDBDetailsTokenInputField,
} from './tracking';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxFluxDBConnection = (props: Props) => {
  const { options, onOptionsChange } = props;
  const { jsonData, secureJsonData, secureJsonFields } = options;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Organization" labelWidth={30} grow>
          <Input
            onBlur={trackInfluxDBConfigV2FluxDBDetailsOrgInputField}
            onChange={onUpdateDatasourceJsonDataOption(props, 'organization')}
            value={jsonData.organization || ''}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={30} label="Default Bucket" grow>
          <Input
            onBlur={trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField}
            onChange={onUpdateDatasourceJsonDataOption(props, 'defaultBucket')}
            placeholder="default bucket"
            value={jsonData.defaultBucket || ''}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={30} label="Token" grow>
          <SecretInput
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            onBlur={() => {
              onOptionsChange({
                ...options,
                secureJsonFields: {
                  ...secureJsonFields,
                  token: true,
                },
              });
              trackInfluxDBConfigV2FluxDBDetailsTokenInputField();
            }}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            value={secureJsonData?.token || ''}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
