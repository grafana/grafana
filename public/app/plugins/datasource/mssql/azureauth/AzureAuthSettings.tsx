import React, { useMemo } from 'react';

import { config } from '@grafana/runtime';
// import { InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

import { KnownAzureClouds, AzureCredentials } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export const AzureAuthSettings = (props: HttpSettingsBaseProps) => {
  const { dataSourceConfig: dsSettings, onChange } = props;
  const managedIdentityEnabled = config.azure.managedIdentityEnabled;

  // const [overrideAudienceAllowed] = useState<boolean>(
  //   // JEV: FF this feature/or remove?
  //   config.featureToggles.prometheusAzureOverrideAudience || !!dsSettings.jsonData.azureEndpointResourceId
  // );

  // const [overrideAudienceChecked, setOverrideAudienceChecked] = useState<boolean>(
  //   !!dsSettings.jsonData.azureEndpointResourceId
  // );

  const credentials = useMemo(() => getCredentials(dsSettings, config), [dsSettings]);

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    onChange(updateCredentials(dsSettings, config, credentials));
  };

  // const onOverrideAudienceChange = (ev: FormEvent<HTMLInputElement>): void => {
  //   setOverrideAudienceChecked(ev.currentTarget.checked);
  //   if (!ev.currentTarget.checked) {
  //     onChange({
  //       ...dsSettings,
  //       jsonData: { ...dsSettings.jsonData, azureEndpointResourceId: undefined },
  //     });
  //   }
  // };

  // const onResourceIdChange = (ev: FormEvent<HTMLInputElement>): void => {
  //   if (overrideAudienceChecked) {
  //     onChange({
  //       ...dsSettings,
  //       jsonData: { ...dsSettings.jsonData, azureEndpointResourceId: ev.currentTarget.value },
  //     });
  //   }
  // };

  return (
    <>
      {/* <h6>Azure authentication</h6> */}
      <AzureCredentialsForm
        managedIdentityEnabled={managedIdentityEnabled}
        credentials={credentials}
        azureCloudOptions={KnownAzureClouds}
        onCredentialsChange={onCredentialsChange}
        disabled={dsSettings.readOnly}
      />
      {/* {overrideAudienceAllowed && (
        <>
          <h6>Azure configuration</h6>
          <div className="gf-form-group">
            <InlineFieldRow>
              <InlineField labelWidth={26} label="Override AAD audience" disabled={dsSettings.readOnly}>
                <InlineSwitch value={overrideAudienceChecked} onChange={onOverrideAudienceChange} />
              </InlineField>
            </InlineFieldRow>
            {overrideAudienceChecked && (
              <InlineFieldRow>
                <InlineField labelWidth={26} label="Resource ID" disabled={dsSettings.readOnly}>
                  <Input
                    className="width-30"
                    value={dsSettings.jsonData.azureEndpointResourceId || ''}
                    onChange={onResourceIdChange}
                  />
                </InlineField>
              </InlineFieldRow>
            )}
          </div>
        </>
      )} */}
    </>
  );
};

export default AzureAuthSettings;
