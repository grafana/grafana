import React, { FunctionComponent, useEffect, useMemo, useReducer, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { InlineFormLabel, LegacyForms, Button } from '@grafana/ui';
const { Select, Switch } = LegacyForms;
import { AzureDataSourceSettings, AzureCredentials } from '../types';
import {
  getCredentials,
  getLogAnalyticsCredentials,
  isCredentialsComplete,
  updateLogAnalyticsCredentials,
  updateLogAnalyticsSameAs,
} from '../credentials';

export interface Props {
  options: AzureDataSourceSettings;
  updateOptions: (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings) => void;
  getSubscriptions: () => Promise<Array<SelectableValue<string>>>;
  getWorkspaces: (subscriptionId: string) => Promise<Array<SelectableValue<string>>>;
}

export const AnalyticsConfig: FunctionComponent<Props> = (props: Props) => {
  const { updateOptions, getSubscriptions, getWorkspaces } = props;
  const primaryCredentials = useMemo(() => getCredentials(props.options), [props.options]);
  const logAnalyticsCredentials = useMemo(() => getLogAnalyticsCredentials(props.options), [props.options]);
  const subscriptionId = logAnalyticsCredentials
    ? logAnalyticsCredentials.defaultSubscriptionId
    : primaryCredentials.defaultSubscriptionId;

  const credentialsEnabled = primaryCredentials.authType === 'clientsecret';

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

  const [sameAsSwitched, setSameAsSwitched] = useState(false);

  const onCredentialsChange = (updatedCredentials: AzureCredentials) => {
    updateOptions((options) => updateLogAnalyticsCredentials(options, updatedCredentials));
  };

  const onLogAnalyticsSameAsChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const sameAs = event.currentTarget.checked;
    updateOptions((options) => updateLogAnalyticsSameAs(options, sameAs));
    setSameAsSwitched(true);
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

  const showSameAsHelpMsg =
    credentialsEnabled &&
    sameAsSwitched &&
    primaryCredentials.authType === 'clientsecret' &&
    !primaryCredentials.clientSecret;

  return (
    <>
      <h3 className="page-heading">Azure Monitor Logs</h3>
      {credentialsEnabled && (
        <>
          <Switch
            label="Same details as Azure Monitor API"
            checked={!logAnalyticsCredentials}
            onChange={onLogAnalyticsSameAsChange}
            {...tooltipAttribute}
          />
          {showSameAsHelpMsg && (
            <div className="grafana-info-box m-t-2">
              <div className="alert-body">
                <p>Re-enter your Azure Monitor Client Secret to use this setting.</p>
              </div>
            </div>
          )}
          {logAnalyticsCredentials && (
            <AzureCredentialsForm
              managedIdentityEnabled={false}
              credentials={logAnalyticsCredentials}
              onCredentialsChange={onCredentialsChange}
              getSubscriptions={getSubscriptions}
            />
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
