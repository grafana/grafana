import React, { FunctionComponent, useEffect, useMemo, useReducer, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { InlineFormLabel, LegacyForms, Button, Alert } from '@grafana/ui';
const { Select, Switch } = LegacyForms;
import { AzureClientSecretCredentials, AzureDataSourceSettings } from '../types';
import { getCredentials, getLogAnalyticsCredentials, isCredentialsComplete } from '../credentials';

export interface Props {
  options: AzureDataSourceSettings;
  updateOptions: (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings) => void;
  getSubscriptions: () => Promise<Array<SelectableValue<string>>>;
  getWorkspaces: (subscriptionId: string) => Promise<Array<SelectableValue<string>>>;
}

function credentialsDiffer(logCreds: AzureClientSecretCredentials, primaryCreds: AzureClientSecretCredentials) {
  return (
    logCreds.authType !== primaryCreds.authType ||
    logCreds.logAnalyticsClientId !== primaryCreds.clientId ||
    logCreds.logAnalyticsTenantId !== primaryCreds.tenantId ||
    logCreds.logAnalyticsClientSecret !== primaryCreds.clientSecret
  );
}

export const AnalyticsConfig: FunctionComponent<Props> = (props: Props) => {
  const { updateOptions, getSubscriptions, getWorkspaces } = props;
  const primaryCredentials = useMemo(() => getCredentials(props.options), [props.options]);
  const logAnalyticsCredentials = useMemo(() => getLogAnalyticsCredentials(props.options), [props.options]);

  const subscriptionId = logAnalyticsCredentials
    ? logAnalyticsCredentials.defaultSubscriptionId
    : primaryCredentials.defaultSubscriptionId;

  // Only show a section for setting LogAnalytics credentials if
  // they were set from before with different values and the
  // authType is supported
  const [credentialsUsed, _] = useState(
    !!logAnalyticsCredentials &&
      credentialsDiffer(logAnalyticsCredentials, primaryCredentials as AzureClientSecretCredentials)
  );
  const credentialsEnabled = credentialsUsed && primaryCredentials.authType === 'clientsecret';

  const hasRequiredFields =
    subscriptionId &&
    (logAnalyticsCredentials
      ? isCredentialsComplete(logAnalyticsCredentials)
      : isCredentialsComplete(primaryCredentials));

  const defaultWorkspace = props.options.jsonData.logAnalyticsDefaultWorkspace;

  const [workspaces, setWorkspaces] = useState<SelectableValue[]>([]);
  const [loadWorkspaces, onLoadWorkspaces] = useReducer((val) => val + 1, 0);
  useEffect(() => {
    if (!hasRequiredFields || !subscriptionId) {
      updateWorkspaces([]);
      return;
    }
    let canceled = false;
    getWorkspaces(subscriptionId).then((result) => {
      if (!canceled) {
        updateWorkspaces(result);
      }
    });
    return () => {
      canceled = true;
    };
    // This effect is intended to be called only once initially and on Load Workspaces click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWorkspaces, subscriptionId]);

  const updateWorkspaces = (received: Array<SelectableValue<string>>) => {
    setWorkspaces(received);
    if (!defaultWorkspace && received.length > 0) {
      // Setting the default workspace if workspaces received but no default workspace selected
      updateOptions((options) => {
        return {
          ...options,
          jsonData: {
            ...options.jsonData,
            logAnalyticsDefaultWorkspace: received[0].value,
          },
        };
      });
    } else if (defaultWorkspace) {
      const found = received.find((opt) => opt.value === defaultWorkspace);
      if (!found) {
        // Unsetting the default workspace if it isn't found among the received workspaces
        updateOptions((options) => {
          return {
            ...options,
            jsonData: {
              ...options.jsonData,
              logAnalyticsDefaultWorkspace: undefined,
            },
          };
        });
      }
    }
  };

  const onDefaultWorkspaceChange = (selected: SelectableValue<string>) => {
    updateOptions((options) => {
      return {
        ...options,
        jsonData: {
          ...options.jsonData,
          logAnalyticsDefaultWorkspace: selected.value || '',
        },
      };
    });
  };

  const tooltipAttribute = {
    ...(!logAnalyticsCredentials && {
      tooltip: 'Workspaces are pulled from default subscription selected above.',
    }),
  };

  return (
    <>
      <h3 className="page-heading">Azure Monitor Logs</h3>
      {credentialsEnabled && (
        <>
          <Switch
            label="Same details as Azure Monitor API"
            // no-op, fake disabled switch
            checked={true}
            onChange={() => {}}
            {...tooltipAttribute}
          />

          {logAnalyticsCredentials && (
            <>
              <Alert severity="error" title="Deprecated">
                Using different credentials for Azure Monitor Logs is no longer supported. Authentication information
                above will be used instead. Please create a new data source with the credentials below.
              </Alert>

              <AzureCredentialsForm
                managedIdentityEnabled={false}
                credentials={
                  {
                    ...logAnalyticsCredentials,
                    tenantId: logAnalyticsCredentials.logAnalyticsTenantId,
                    clientId: logAnalyticsCredentials.logAnalyticsClientId,
                    clientSecret: logAnalyticsCredentials.logAnalyticsClientSecret,
                  } as AzureClientSecretCredentials
                }
                getSubscriptions={getSubscriptions}
                disabled={true}
              />
            </>
          )}
        </>
      )}
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              className="width-12"
              tooltip="Choose the default/preferred Workspace for Azure Log Analytics queries."
            >
              Default Workspace
            </InlineFormLabel>
            <div className="width-25">
              <Select
                value={workspaces.find((opt) => opt.value === defaultWorkspace)}
                options={workspaces}
                onChange={onDefaultWorkspaceChange}
              />
            </div>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <div className="max-width-30 gf-form-inline">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={onLoadWorkspaces}
                disabled={!hasRequiredFields}
              >
                Load Workspaces
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AnalyticsConfig;
