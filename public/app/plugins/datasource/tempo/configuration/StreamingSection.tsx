import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { InlineFieldRow, InlineField, InlineSwitch, Alert } from '@grafana/ui';

import { FeatureName, featuresToTempoVersion } from '../datasource';

interface StreamingOptions extends DataSourceJsonData {
  streamingEnabled?: {
    search?: boolean;
  };
}
interface Props extends DataSourcePluginOptionsEditorProps<StreamingOptions> {}

export const StreamingSection = ({ options, onOptionsChange }: Props) => {
  return (
    <ConfigSection
      title="Streaming"
      description={`Enable streaming for different Tempo features. 
        Currently supported only for search queries and from Tempo version ${featuresToTempoVersion[FeatureName.streaming]} onwards.`}
      isCollapsible={false}
    >
      <Alert severity="info" title="Streaming and on-premise Tempo instances">
        If your Tempo instance is on-premise and behind a load balancer or proxy that does not supporting gRPC or HTTP2,
        streaming will probably not work and should be disabled.
      </Alert>
      <InlineFieldRow>
        <InlineField
          tooltip={`Enable streaming for search queries. Minimum required version for Tempo: ${featuresToTempoVersion[FeatureName.streaming]}.`}
          label="Queries"
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
    </ConfigSection>
  );
};
