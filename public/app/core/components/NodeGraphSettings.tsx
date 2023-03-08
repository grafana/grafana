import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';

export interface NodeGraphOptions {
  enabled?: boolean;
}

export interface NodeGraphData extends DataSourceJsonData {
  nodeGraph?: NodeGraphOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<NodeGraphData> {}

export function NodeGraphSettings({ options, onOptionsChange }: Props) {
  return (
    <div className={styles.container}>
      <h3 className="page-heading">Node graph</h3>
      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="Displays the node graph above the trace view" label="Enable node graph" labelWidth={26}>
          <InlineSwitch
            id="enableNodeGraph"
            value={options.jsonData.nodeGraph?.enabled}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'nodeGraph', {
                ...options.jsonData.nodeGraph,
                enabled: event.currentTarget.checked,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}

const styles = {
  container: css`
    label: container;
    width: 100%;
  `,
  row: css`
    label: row;
    align-items: baseline;
  `,
};
