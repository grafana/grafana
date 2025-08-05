import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { ConfigSection } from '@grafana/plugin-ui';
import { InlineFieldRow, InlineField, InlineSwitch, Alert, Stack, TextLink } from '@grafana/ui';

import { FeatureName, featuresToTempoVersion } from '../datasource';

interface StreamingOptions extends DataSourceJsonData {
  streamingEnabled?: {
    search?: boolean;
    metrics?: boolean;
  };
}
interface Props extends DataSourcePluginOptionsEditorProps<StreamingOptions> {}

export const StreamingSection = ({ options, onOptionsChange }: Props) => {
  return (
    <ConfigSection
      title="Streaming"
      isCollapsible={false}
      description={
        <Stack gap={0.5}>
          <div>Enable streaming for different Tempo features.</div>
          <TextLink href={'https://grafana.com/docs/tempo/latest/traceql/#stream-query-results'}>Learn more</TextLink>
        </Stack>
      }
    >
      <Alert severity="info" title="Streaming and self-managed Tempo instances">
        If your Tempo instance is behind a load balancer or proxy that does not supporting gRPC or HTTP2, streaming will
        probably not work and should be disabled.
      </Alert>
      <InlineFieldRow>
        <InlineField
          tooltip={`Enable streaming for search queries. Minimum required version for Tempo: ${featuresToTempoVersion[FeatureName.searchStreaming]}.`}
          label="Search queries"
          labelWidth={26}
        >
          <InlineSwitch
            id={'streamingEnabled.search'}
            // TECHDEBT: We should check whether the feature is supported by the Tempo version,
            // but here we don't have easily access to such information
            value={options.jsonData.streamingEnabled?.search || false}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'streamingEnabled', {
                ...options.jsonData.streamingEnabled,
                search: event.currentTarget.checked,
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          tooltip={`Enable streaming for metrics queries. Minimum required version for Tempo: ${featuresToTempoVersion[FeatureName.metricsStreaming]}.`}
          label="Metrics queries"
          labelWidth={26}
        >
          <InlineSwitch
            id={'streamingEnabled.metrics'}
            // TECHDEBT: We should check whether the feature is supported by the Tempo version,
            // but here we don't have easily access to such information
            value={options.jsonData.streamingEnabled?.metrics || false}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'streamingEnabled', {
                ...options.jsonData.streamingEnabled,
                metrics: event.currentTarget.checked,
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>
    </ConfigSection>
  );
};
