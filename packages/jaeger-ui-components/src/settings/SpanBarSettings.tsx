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
}

export interface SpanBarOptionsData extends DataSourceJsonData {
  spanBar?: SpanBarOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<SpanBarOptionsData> {}

export default function SpanBarSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);
  const selectOptions = ['None', 'Duration', 'Tag'].map(toOption);

  return (
    <div className={css({ width: '100%' })}>
      <h3 className="page-heading">Span bar row identifier</h3>

      <div className={styles.infoText}>
        Enter a tag key (from which the value will be extracted) and added to the span bar row.
      </div>

      <InlineFieldRow className={styles.row}>
        <InlineField label="Identifier" labelWidth={26} grow>
          <Select
            inputId="identifier"
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
            aria-label={'select-identifier-name'}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
      {options.jsonData.spanBar?.type === 'Tag' && (
        <InlineFieldRow className={styles.row}>
          <InlineField label="Tag key" labelWidth={26} grow tooltip="Tag key (from which the value will be extracted)">
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
