import React from 'react';

import { Switch } from '@grafana/ui';

type FeatureToggle = {
  name: string;
  enabled: boolean;
  readonly: boolean;
};

interface Props {
  featureToggles: FeatureToggle[];
  onToggleChange: (featureToggle: FeatureToggle, enabled: boolean) => void;
}

export function AdminFeatureTogglesTable({ featureToggles, onToggleChange }: Props) {
  const handleToggleChange = (featureToggle: FeatureToggle) => {
    onToggleChange(featureToggle, !featureToggle.enabled);
  };

  const featureTogglesDescriptions = {
    advancedDataSourcePicker:
      'Enable a new data source picker with contextual information, recently used order and advanced mode',
    alertingNotificationsPoliciesMatchingInstances: '', // Not Found in the list
    athenaAsyncQueryDataSupport: 'Enable async query data support for Athena',
    cloudWatchCrossAccountQuerying: 'Enables cross-account querying in CloudWatch datasources',
    dataConnectionsConsole:
      'Enables a new top-level page called Connections. This page is an experiment that provides a better experience when you install and configure data sources and other plugins.',
    dataplaneFrontendFallback:
      'Support dataplane contract field name change for transformations and field name matchers where the name is different',
    emptyDashboardPage: 'Enable the redesigned user interface of a dashboard page that includes no panels',
    exploreMixedDatasource: 'Enable mixed datasource in Explore',
    logsContextDatasourceUi: 'Allow datasource to provide custom UI for context view',
    logsSampleInExplore: 'Enables access to the logs sample feature in Explore',
    lokiMetricDataplane: 'Changes metric responses from Loki to be compliant with the dataplane specification.',
    newPanelChromeUI: 'Show updated look and feel of grafana-ui PanelChrome: panel header, icons, and menu',
    prometheusDataplane:
      'Changes responses to from Prometheus to be compliant with the dataplane specification. In particular it sets the numeric Field.Name from ‘Value’ to the value of the __name__ label when present.',
    prometheusMetricEncyclopedia:
      'Replaces the Prometheus query builder metric select option with a paginated and filterable component',
    redshiftAsyncQueryDataSupport: 'Enable async query data support for Redshift',
    topnav: 'Enables new top navigation and page layouts',
  };

  return (
    <table className="filter-table form-inline filter-table--hover">
      <thead>
        <tr>
          <th>Name</th>
          <th>Description</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {featureToggles.map((featureToggle) => (
          <tr key={`${featureToggle.name}`}>
            <td>
              <div>{featureToggle.name}</div>
            </td>
            <td
              style={{
                overflowWrap: 'break-word',
                wordWrap: 'break-word',
                whiteSpace: 'normal',
              }}
            >
              {featureTogglesDescriptions[featureToggle.name] || 'No description'}
            </td>
            <td style={{ lineHeight: 'normal' }}>
              <div>
                <Switch
                  value={featureToggle.enabled}
                  disabled={featureToggle.readonly}
                  onChange={() => handleToggleChange(featureToggle)}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
