import { produce } from 'immer';
import { useEffect } from 'react';
import { Link } from 'react-router-dom-v5-compat';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import { Box, DataSourceHttpSettings, InlineField, InlineSwitch, Select, Text } from '@grafana/ui';
import { config } from 'app/core/config';

import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from './types';

export type Props = DataSourcePluginOptionsEditorProps<AlertManagerDataSourceJsonData>;

const IMPL_OPTIONS: Array<SelectableValue<AlertManagerImplementation>> = [
  {
    value: AlertManagerImplementation.mimir,
    label: 'Mimir',
    description: `https://grafana.com/oss/mimir/. An open source, horizontally scalable, highly available, multi-tenant, long-term storage for Prometheus.`,
  },
  {
    value: AlertManagerImplementation.cortex,
    label: 'Cortex',
    description: `https://cortexmetrics.io/`,
  },
  {
    value: AlertManagerImplementation.prometheus,
    label: 'Prometheus',
    description:
      'https://prometheus.io/. Does not support editing configuration via API, so contact points and notification policies are read-only.',
  },
];

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  // As we default to Mimir, we need to make sure the implementation is set from the start
  useEffect(() => {
    if (!options.jsonData.implementation) {
      onOptionsChange(
        produce(options, (draft) => {
          draft.jsonData.implementation = AlertManagerImplementation.mimir;
        })
      );
    }
  }, [options, onOptionsChange]);

  return (
    <>
      <h3 className="page-heading">Alertmanager</h3>
      <Box marginBottom={5}>
        <InlineField label="Implementation" labelWidth={26}>
          <Select
            width={40}
            options={IMPL_OPTIONS}
            value={options.jsonData.implementation || AlertManagerImplementation.mimir}
            onChange={(value) =>
              onOptionsChange({
                ...options,
                jsonData: {
                  ...options.jsonData,
                  implementation: value.value,
                },
              })
            }
          />
        </InlineField>
        <InlineField
          label="Receive Grafana Alerts"
          tooltip="When enabled, Grafana-managed alerts are sent to this Alertmanager."
          labelWidth={26}
        >
          <InlineSwitch
            value={options.jsonData.handleGrafanaManagedAlerts ?? false}
            onChange={(e) => {
              onOptionsChange(
                produce(options, (draft) => {
                  draft.jsonData.handleGrafanaManagedAlerts = e.currentTarget.checked;
                })
              );
            }}
          />
        </InlineField>
        {options.jsonData.handleGrafanaManagedAlerts && (
          <Text variant="bodySmall" color="secondary">
            Make sure to enable the alert forwarding on the <Link to="/alerting/admin">settings page</Link>.
          </Text>
        )}
      </Box>
      <DataSourceHttpSettings
        defaultUrl={''}
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        renderSigV4Editor={<SIGV4ConnectionConfig {...props}></SIGV4ConnectionConfig>}
        secureSocksDSProxyEnabled={false} // the proxy is not implemented to work with the alertmanager
      />
    </>
  );
};
