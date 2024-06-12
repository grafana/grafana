import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { InlineFieldRow, InlineField, InlineSwitch } from '@grafana/ui';

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
      description="Enable streaming for different Tempo features. Currently supported only for search queries."
      isCollapsible={false}
    >
      <InlineFieldRow>
        <InlineField tooltip="Enable streaming for search queries" label="Queries" labelWidth={26}>
          <InlineSwitch
            id={'streamingEnabled.search'}
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
