import React, { FunctionComponent, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getCredentials, updateCredentials } from '../credentials';
import { AzureDataSourceSettings, AzureCredentials } from '../types';

import { AzureCredentialsForm } from './AzureCredentialsForm';

const azureClouds = [
  { value: 'azuremonitor', label: 'Azure' },
  { value: 'govazuremonitor', label: 'Azure US Government' },
  { value: 'germanyazuremonitor', label: 'Azure Germany' },
  { value: 'chinaazuremonitor', label: 'Azure China' },
] as SelectableValue[];

export interface Props {
  options: AzureDataSourceSettings;
  updateOptions: (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings) => void;
  getSubscriptions: () => Promise<Array<SelectableValue<string>>>;
}

export const MonitorConfig: FunctionComponent<Props> = (props: Props) => {
  const { updateOptions, getSubscriptions } = props;
  const credentials = useMemo(() => getCredentials(props.options), [props.options]);

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    updateOptions((options) => updateCredentials(options, credentials));
  };

  return (
    <>
      <h3 className="page-heading">Authentication</h3>
      <AzureCredentialsForm
        managedIdentityEnabled={config.azure.managedIdentityEnabled}
        credentials={credentials}
        azureCloudOptions={azureClouds}
        onCredentialsChange={onCredentialsChange}
        getSubscriptions={getSubscriptions}
        disabled={props.options.readOnly}
      />
    </>
  );
};

export default MonitorConfig;
