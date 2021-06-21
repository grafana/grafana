import React, { FunctionComponent, useEffect, useMemo, useReducer, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { InlineFormLabel, LegacyForms, Button, Alert } from '@grafana/ui';
const { Select } = LegacyForms;
import { AzureDataSourceSettings } from '../types';
import { getCredentials, isCredentialsComplete } from '../credentials';

export interface Props {
  options: AzureDataSourceSettings;
  updateOptions: (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings) => void;
  getSubscriptions: () => Promise<Array<SelectableValue<string>>>;
  getWorkspaces: (subscriptionId: string) => Promise<Array<SelectableValue<string>>>;
}

export const AnalyticsConfig: FunctionComponent<Props> = (props: Props) => {
  const { updateOptions, getSubscriptions, getWorkspaces } = props;
  const primaryCredentials = useMemo(() => getCredentials(props.options), [props.options]);

  const subscriptionId = primaryCredentials.defaultSubscriptionId;

  // Only show a section for setting LogAnalytics credentials if
  // they were set from before with different values and the
  // authType is supported
  const logCredentialsEnabled =
    primaryCredentials.authType === 'clientsecret' && props.options.jsonData.azureLogAnalyticsSameAs === false;

  const hasRequiredFields = subscriptionId && isCredentialsComplete(primaryCredentials);

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

  return (
    <>
      <h3 className="page-heading">Azure Monitor Logs</h3>
      {logCredentialsEnabled && (
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
            getSubscriptions={getSubscriptions}
            disabled={true}
          />
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
                isDisabled={props.options.readOnly}
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
                disabled={!hasRequiredFields || props.options.readOnly}
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
