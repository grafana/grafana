import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';

export interface NodeGraphOptions {
  enabled?: boolean;
}

export interface NodeGraphData extends DataSourceJsonData {
  nodeGraph?: NodeGraphOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<NodeGraphData> {}

export function NodeGraphSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <InlineFieldRow className={styles.row}>
        <InlineField
          tooltip="Displays the node graph above the trace view. Default: disabled"
          label="Enable node graph"
          labelWidth={26}
        >
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

export const NODE_GRAPH_TITLE = 'Node graph';
export const NODE_GRAPH_DESCRIPTION = 'Show or hide the node graph visualization.';
export const NODE_GRAPH_SUFFIX = '#node-graph';

const getStyles = (theme: GrafanaTheme2) => ({
  infoText: css`
    label: infoText;
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
  container: css`
    label: container;
    width: 100%;
  `,
  row: css`
    label: row;
    align-items: baseline;
  `,
});
