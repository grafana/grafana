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
      <h3 className="page-heading">Span bar label</h3>

      <div className={styles.infoText}>Span bar label lets you add additional info to the span bar row.</div>

      <InlineFieldRow className={styles.row}>
        <InlineField label="Label" labelWidth={26} grow>
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
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
      {options.jsonData.spanBar?.type === TAG && (
        <InlineFieldRow className={styles.row}>
          <InlineField label="Tag key" labelWidth={26} tooltip="Tag key which will be used to get the tag value">
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
              width={25}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
}

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
