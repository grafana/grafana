import { css } from '@emotion/css';
import * as React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';

export interface TraceIdTimeParamsOptions {
  enabled?: boolean;
}

export interface TraceIdTimeParamsData extends DataSourceJsonData {
  traceIdTimeParams?: TraceIdTimeParamsOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceIdTimeParamsData> {}

export function TraceIdTimeParams({ options, onOptionsChange }: Props) {
  return (
    <div className={styles.container}>
      <h3 className="page-heading">Query Trace by ID with Time Params</h3>
      <InlineFieldRow className={styles.row}>
        <InlineField
          tooltip="pass time parameters when querying trace by ID"
          label="Enable Time Parameters"
          labelWidth={26}
        >
          <InlineSwitch
            id="enableTraceIdTimeParams"
            value={options.jsonData.traceIdTimeParams?.enabled}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'traceIdTimeParams', {
                ...options.jsonData.traceIdTimeParams,
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
  container: css({
    label: 'container',
    width: '100%',
  }),
  row: css({
    label: 'row',
    alignItems: 'baseline',
  }),
};
