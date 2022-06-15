import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Input, useStyles } from '@grafana/ui';

export interface SpanBarOptions {
  tag?: string;
}

export interface SpanBarOptionsData extends DataSourceJsonData {
  spanBar?: SpanBarOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<SpanBarOptionsData> {}

export default function SpanBarSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);

  return (
    <div className={css({ width: '100%' })}>
      <h3 className="page-heading">Span bar row identifier</h3>

      <div className={styles.infoText}>
        Enter a tag key (from which the value will be extracted) and added to the span bar row.
      </div>

      <InlineFieldRow className={styles.row}>
        <InlineField label="Tag key" labelWidth={26} grow tooltip="Tag key (from which the value will be extracted)">
          <Input
            type="text"
            placeholder=""
            width={40}
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'spanBar', {
                ...options.jsonData.spanBar,
                tag: v.currentTarget.value,
              })
            }
            value={options.jsonData.spanBar?.tag || ''}
          />
        </InlineField>
      </InlineFieldRow>
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
