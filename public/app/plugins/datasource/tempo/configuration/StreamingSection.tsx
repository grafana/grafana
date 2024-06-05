import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { InlineFieldRow, InlineField, InlineSwitch } from '@grafana/ui';

interface StreamingOptions extends DataSourceJsonData {
  streamingEnablement?: {
    search?: boolean;
  };
}
interface Props extends DataSourcePluginOptionsEditorProps<StreamingOptions> {}

export const StreamingSection = ({ options, onOptionsChange }: Props) => {
  return (
    <ConfigSection title="Streaming" description="Enable streaming for different Tempo features." isCollapsible={false}>
      <InlineFieldRow>
        <InlineField tooltip="Enable streaming for search queries" label="Queries" labelWidth={26}>
          <InlineSwitch
            id={'streaming.search'}
            value={options.jsonData.streamingEnablement?.search || false}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'streamingEnablement', {
                ...options.jsonData.streamingEnablement,
                search: event.currentTarget.checked,
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>
    </ConfigSection>
  );
};
