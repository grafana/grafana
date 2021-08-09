import React, { FunctionComponent, useMemo } from 'react';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { Button, Alert } from '@grafana/ui';
import { AzureDataSourceSettings } from '../types';
import { getCredentials } from '../credentials';

export interface Props {
  options: AzureDataSourceSettings;
  updateOptions: (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings) => void;
}

export const AnalyticsConfig: FunctionComponent<Props> = (props: Props) => {
  const { updateOptions } = props;
  const primaryCredentials = useMemo(() => getCredentials(props.options), [props.options]);

  // Only show a section for setting LogAnalytics credentials if
  // they were set from before with different values and the
  // authType is supported
  const logCredentialsEnabled =
    primaryCredentials.authType === 'clientsecret' && props.options.jsonData.azureLogAnalyticsSameAs === false;

  const onClearAzLogsCreds = () => {
    updateOptions((options) => {
      return {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureLogAnalyticsSameAs: true,
        },
      };
    });
  };

  return logCredentialsEnabled ? (
    <>
      <h3 className="page-heading">Azure Monitor Logs</h3>
      <>
        <Alert severity="error" title="Deprecated">
          Using different credentials for Azure Monitor Logs is no longer supported. Authentication information above
          will be used instead. Please create a new data source with the credentials below.
        </Alert>

        <AzureCredentialsForm
          managedIdentityEnabled={false}
          credentials={{
            ...primaryCredentials,
            authType: 'clientsecret',
            // Use deprecated Log Analytics credentials read-only
            // to help with a possible migration
            tenantId: props.options.jsonData.logAnalyticsTenantId,
            clientId: props.options.jsonData.logAnalyticsClientId,
          }}
          disabled={true}
        >
          <Button onClick={onClearAzLogsCreds}>Clear Azure Monitor Logs Credentials</Button>
        </AzureCredentialsForm>
      </>
    </>
  ) : null;
};

export default AnalyticsConfig;
