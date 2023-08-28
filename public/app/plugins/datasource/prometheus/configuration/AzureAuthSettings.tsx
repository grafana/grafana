import { cx } from '@emotion/css';
import React, { FormEvent, useMemo, useState } from 'react';

import { config } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

import { KnownAzureClouds, AzureCredentials } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export const AzureAuthSettings = (props: HttpSettingsBaseProps) => {
  const { dataSourceConfig, onChange } = props;

  const [overrideAudienceChecked, setOverrideAudienceChecked] = useState<boolean>(
    !!dataSourceConfig.jsonData.azureEndpointResourceId
  );

  const credentials = useMemo(() => getCredentials(dataSourceConfig), [dataSourceConfig]);

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    onChange(updateCredentials(dataSourceConfig, credentials));
  };

  const onOverrideAudienceChange = (ev: FormEvent<HTMLInputElement>): void => {
    setOverrideAudienceChecked(ev.currentTarget.checked);
    if (!ev.currentTarget.checked) {
      onChange({
        ...dataSourceConfig,
        jsonData: { ...dataSourceConfig.jsonData, azureEndpointResourceId: undefined },
      });
    }
  };

  const onResourceIdChange = (ev: FormEvent<HTMLInputElement>): void => {
    if (overrideAudienceChecked) {
      onChange({
        ...dataSourceConfig,
        jsonData: { ...dataSourceConfig.jsonData, azureEndpointResourceId: ev.currentTarget.value },
      });
    }
  };

  const prometheusConfigOverhaulAuth = config.featureToggles.prometheusConfigOverhaulAuth;

  const labelWidth = prometheusConfigOverhaulAuth ? 24 : 26;

  return (
    <>
      <h6>Azure authentication</h6>
      <AzureCredentialsForm
        managedIdentityEnabled={config.azure.managedIdentityEnabled}
        credentials={credentials}
        azureCloudOptions={KnownAzureClouds}
        onCredentialsChange={onCredentialsChange}
        disabled={dataSourceConfig.readOnly}
      />
      <h6>Azure configuration</h6>
      <div className="gf-form-group">
        <InlineFieldRow>
          <InlineField labelWidth={labelWidth} label="Override AAD audience" disabled={dataSourceConfig.readOnly}>
            <InlineSwitch value={overrideAudienceChecked} onChange={onOverrideAudienceChange} />
          </InlineField>
        </InlineFieldRow>
        {overrideAudienceChecked && (
          <InlineFieldRow>
            <InlineField labelWidth={labelWidth} label="Resource ID" disabled={dataSourceConfig.readOnly}>
              <Input
                className={cx(prometheusConfigOverhaulAuth ? 'width-20' : 'width-30')}
                value={dataSourceConfig.jsonData.azureEndpointResourceId || ''}
                onChange={onResourceIdChange}
              />
            </InlineField>
          </InlineFieldRow>
        )}
      </div>
    </>
  );
};

export default AzureAuthSettings;
