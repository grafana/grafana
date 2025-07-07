import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import {
  trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField,
  trackInfluxDBConfigV2FluxDBDetailsOrgInputField,
  trackInfluxDBConfigV2FluxDBDetailsTokenInputField,
} from './tracking';
import { Props } from './types';

export const InfluxFluxDBConnection = (props: Props) => {
  const {
    options: { jsonData, secureJsonData, secureJsonFields },
  } = props;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Organization" labelWidth={30} grow>
          <Input
            id="organization"
            placeholder="myorg"
            onBlur={trackInfluxDBConfigV2FluxDBDetailsOrgInputField}
            onChange={onUpdateDatasourceJsonDataOption(props, 'organization')}
            value={jsonData.organization || ''}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={30} label="Default Bucket" grow>
          <Input
            id="default-bucket"
            onBlur={trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField}
            onChange={onUpdateDatasourceJsonDataOption(props, 'defaultBucket')}
            placeholder="mybucket"
            value={jsonData.defaultBucket || ''}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={30} label="Token" grow>
          <SecretInput
            id="token"
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            onBlur={trackInfluxDBConfigV2FluxDBDetailsTokenInputField}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            value={secureJsonData?.token || ''}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
