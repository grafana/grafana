import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme,
  toOption,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select, useStyles } from '@grafana/ui';

export interface SpanBarOptions {
  type?: string;
  tag?: string;
  process?: string;
}

export interface SpanBarOptionsData extends DataSourceJsonData {
  spanBar?: SpanBarOptions;
}

export const NONE = 'None';
export const DURATION = 'Duration';
export const TAG = 'Tag';
export const PROCESS = 'Process';

interface Props extends DataSourcePluginOptionsEditorProps<SpanBarOptionsData> {}

export default function SpanBarSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);
  const selectOptions = [NONE, DURATION, TAG, PROCESS].map(toOption);

  return (
    <div className={css({ width: '100%' })}>
      <h3 className="page-heading">Span bar info</h3>

      <div className={styles.infoText}>Span bar info lets you add additional info to your span bar row.</div>

      <InlineFieldRow className={styles.row}>
        <InlineField label="Info" labelWidth={26} grow>
          <Select
            inputId="info"
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
            aria-label={'select-info-name'}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
      {options.jsonData.spanBar?.type === TAG && (
        <InlineFieldRow className={styles.row}>
          <InlineField label="Tag key" labelWidth={26} grow tooltip="Tag key which will be used to get tag value">
            <Input
              type="text"
              placeholder=""
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
      {options.jsonData.spanBar?.type === PROCESS && (
        <InlineFieldRow className={styles.row}>
          <InlineField
            label="Process key"
            labelWidth={26}
            grow
            tooltip="Process key which will be used to get process value"
          >
            <Input
              type="text"
              placeholder=""
              onChange={(v) =>
                updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'spanBar', {
                  ...options.jsonData.spanBar,
                  process: v.currentTarget.value,
                })
              }
              value={options.jsonData.spanBar?.process || ''}
              width={25}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme) => ({
  infoText: css`
    label: infoText;
    padding-bottom: ${theme.spacing.md};
    color: ${theme.colors.textSemiWeak};
  `,

  row: css`
    label: row;
    align-items: baseline;
  `,
});
