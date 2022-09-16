import { css } from '@emotion/css';
import React from 'react';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, useStyles } from '@grafana/ui';

import { TempoJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function LokiSearchSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);

  // Default to the trace to logs datasource if configured and loki search was enabled
  // but only if jsonData.lokiSearch hasn't been set
  const legacyDatasource =
    options.jsonData.tracesToLogs?.lokiSearch !== false ? options.jsonData.tracesToLogs?.datasourceUid : undefined;
  if (legacyDatasource && options.jsonData.lokiSearch === undefined) {
    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'lokiSearch', {
      datasourceUid: legacyDatasource,
    });
  }

  return (
    <div className={css({ width: '100%' })}>
      <h3 className="page-heading">Loki Search</h3>

      <div className={styles.infoText}>
        Select a Loki datasource to search for traces. Derived fields must be configured in the Loki data source.
      </div>

      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="The Loki data source with the service graph data" label="Data source" labelWidth={26}>
          <DataSourcePicker
            inputId="loki-search-data-source-picker"
            pluginId="loki"
            current={options.jsonData.lokiSearch?.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'lokiSearch', {
                datasourceUid: ds.uid,
              })
            }
          />
        </InlineField>
        {options.jsonData.lokiSearch?.datasourceUid ? (
          <Button
            type={'button'}
            variant={'secondary'}
            size={'sm'}
            fill={'text'}
            onClick={() => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'lokiSearch', {
                datasourceUid: undefined,
              });
            }}
          >
            Clear
          </Button>
        ) : null}
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
