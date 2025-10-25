import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Input, SecretInput, Field, Box } from '@grafana/ui';

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
      <Box marginBottom={2}>
        <Field label="Organization" required noMargin>
          <Input
            id="organization"
            placeholder="myorg"
            onBlur={trackInfluxDBConfigV2FluxDBDetailsOrgInputField}
            onChange={onUpdateDatasourceJsonDataOption(props, 'organization')}
            value={jsonData.organization || ''}
          />
        </Field>
      </Box>
      <Box marginBottom={2}>
        <Field label="Default Bucket" required noMargin>
          <Input
            id="default-bucket"
            onBlur={trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField}
            onChange={onUpdateDatasourceJsonDataOption(props, 'defaultBucket')}
            placeholder="mybucket"
            value={jsonData.defaultBucket || ''}
          />
        </Field>
      </Box>
      <Box marginBottom={2}>
        <Field label="Token" required noMargin>
          <SecretInput
            id="token"
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            onBlur={trackInfluxDBConfigV2FluxDBDetailsTokenInputField}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            value={secureJsonData?.token || ''}
          />
        </Field>
      </Box>
    </>
  );
};
