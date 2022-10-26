import { css } from '@emotion/css';
import React from 'react';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, useStyles } from '@grafana/ui';

import { TempoJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function QuerySettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.container}>
      <h3 className="page-heading">TraceID Query</h3>
      <InlineFieldRow>
        <InlineField
          label="Time shift for start of search"
          labelWidth={26}
          grow
          tooltip="Shifts the start of the time range when searching by trace ID. This is needed as searching for traces can return traces that do not fully fall into the search time range, so we recommend using higher time shifts for longer traces. Default 30m (Time units can be used here, for example: 5s, 1m, 3h)"
        >
          <Input
            type="text"
            placeholder="30m"
            width={40}
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'traceQuery', {
                ...options.jsonData.traceQuery,
                spanStartTimeShift: v.currentTarget.value,
              })
            }
            value={options.jsonData.traceQuery?.spanStartTimeShift || ''}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Time shift for end of search"
          labelWidth={26}
          grow
          tooltip="Shifts the end of the time range when searching by trace ID. This is needed as searching for traces can return traces that do not fully fall into the search time range, so we recommend using higher time shifts for longer traces. Default 30m (Time units can be used here, for example: 5s, 1m, 3h)"
        >
          <Input
            type="text"
            placeholder="30m"
            width={40}
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'traceQuery', {
                ...options.jsonData.traceQuery,
                spanEndTimeShift: v.currentTarget.value,
              })
            }
            value={options.jsonData.traceQuery?.spanEndTimeShift || ''}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}

const getStyles = () => ({
  container: css`
    label: container;
    width: 100%;
  `,
  row: css`
    label: row;
    align-items: baseline;
  `,
});
