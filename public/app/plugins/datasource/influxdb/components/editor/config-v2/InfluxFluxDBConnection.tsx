import { useEffect, useState } from 'react';

import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Input, SecretInput, Field, Space, Box } from '@grafana/ui';

import {
  trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField,
  trackInfluxDBConfigV2FluxDBDetailsOrgInputField,
  trackInfluxDBConfigV2FluxDBDetailsTokenInputField,
} from './tracking';
import { type Props } from './types';

export const InfluxFluxDBConnection = (props: Props) => {
  const {
    options: { jsonData, secureJsonData, secureJsonFields },
    validation,
  } = props;

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const tokenConfigured = Boolean(secureJsonFields?.token);
  const tokenEntered = Boolean(secureJsonData?.token);

  useEffect(() => {
    if (!validation) {
      return;
    }
    if (jsonData.organization) {
      setFieldErrors(({ organization: _, ...rest }) => rest);
      validation.clearError('organization');
    }
    if (jsonData.defaultBucket) {
      setFieldErrors(({ defaultBucket: _, ...rest }) => rest);
      validation.clearError('defaultBucket');
    }
    if (tokenConfigured || tokenEntered) {
      setFieldErrors(({ token: _, ...rest }) => rest);
      validation.clearError('token');
    }
    return validation.registerValidation(() => {
      const errors: Record<string, string> = {};
      if (!jsonData.organization) {
        errors.organization = 'Organization is required';
      }
      if (!jsonData.defaultBucket) {
        errors.defaultBucket = 'Default bucket is required';
      }
      if (!tokenConfigured && !tokenEntered) {
        errors.token = 'Token is required';
      }
      setFieldErrors(errors);
      Object.entries(errors).forEach(([field, msg]) => validation.setError(field, msg));
      if (!errors.organization) {
        validation.clearError('organization');
      }
      if (!errors.defaultBucket) {
        validation.clearError('defaultBucket');
      }
      if (!errors.token) {
        validation.clearError('token');
      }
      return Object.keys(errors).length === 0;
    });
  }, [jsonData.organization, jsonData.defaultBucket, tokenConfigured, tokenEntered, validation]);

  return (
    <Box width="50%">
      <Field
        label="Organization"
        required
        noMargin
        invalid={!!fieldErrors.organization}
        error={fieldErrors.organization}
      >
        <Input
          id="organization"
          placeholder="myorg"
          onBlur={trackInfluxDBConfigV2FluxDBDetailsOrgInputField}
          onChange={onUpdateDatasourceJsonDataOption(props, 'organization')}
          value={jsonData.organization || ''}
        />
      </Field>
      <Space v={2} />
      <Field
        label="Default bucket"
        required
        noMargin
        invalid={!!fieldErrors.defaultBucket}
        error={fieldErrors.defaultBucket}
      >
        <Input
          id="default-bucket"
          onBlur={trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField}
          onChange={onUpdateDatasourceJsonDataOption(props, 'defaultBucket')}
          placeholder="mybucket"
          value={jsonData.defaultBucket || ''}
        />
      </Field>
      <Space v={2} />
      <Field label="Token" required noMargin invalid={!!fieldErrors.token} error={fieldErrors.token}>
        <SecretInput
          id="token"
          isConfigured={tokenConfigured}
          onBlur={trackInfluxDBConfigV2FluxDBDetailsTokenInputField}
          onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
          onReset={() => updateDatasourcePluginResetOption(props, 'token')}
          value={secureJsonData?.token || ''}
        />
      </Field>
    </Box>
  );
};
