import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  toOption,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';

export interface SpanBarOptions {
  type?: string;
  tag?: string;
}

export interface SpanBarOptionsData extends DataSourceJsonData {
  spanBar?: SpanBarOptions;
}

export const NONE = 'None';
export const DURATION = 'Duration';
export const TAG = 'Tag';

interface Props extends DataSourcePluginOptionsEditorProps<SpanBarOptionsData> {}

export default function SpanBarSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);
  const selectOptions = [NONE, DURATION, TAG].map(toOption);

  return (
    <div className={css({ width: '100%' })}>
      <InlineFieldRow className={styles.row}>
        <InlineField label="Label" labelWidth={26} tooltip="Default: duration" grow>
          <Select
            inputId="label"
            options={selectOptions}
            value={options.jsonData.spanBar?.type || ''}
            onChange={(v) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'spanBar', {
                ...options.jsonData.spanBar,
                type: v?.value ?? '',
              });
            }}
            placeholder="Duration"
            isClearable
            aria-label={'select-label-name'}
            width={40}
          />
        </InlineField>
      </InlineFieldRow>
      {options.jsonData.spanBar?.type === TAG && (
        <InlineFieldRow className={styles.row}>
          <InlineField
            label="Tag key"
            labelWidth={26}
            tooltip="Tag key which will be used to get the tag value. A span's attributes and resources will be searched for the tag key"
          >
            <Input
              type="text"
              placeholder="Enter tag key"
              onChange={(v) =>
                updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'spanBar', {
                  ...options.jsonData.spanBar,
                  tag: v.currentTarget.value,
                })
              }
              value={options.jsonData.spanBar?.tag || ''}
              width={40}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
}

export const SPAN_BAR_TITLE = 'Span bar';
export const SPAN_BAR_DESCRIPTION =
  'Add additional info next to the service and operation on a span bar row in the trace view.';
export const SPAN_BAR_SUFFIX = '#span-bar';

const getStyles = (theme: GrafanaTheme2) => ({
  infoText: css`
    label: infoText;
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
  row: css`
    label: row;
    align-items: baseline;
  `,
});
