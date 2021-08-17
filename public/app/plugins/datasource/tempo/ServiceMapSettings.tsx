import { css } from '@emotion/css';
import { DataSourcePluginOptionsEditorProps, GrafanaTheme, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, useStyles } from '@grafana/ui';
import React from 'react';
import { TempoJsonData } from './datasource';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function ServiceMapSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);

  return (
    <div className={css({ width: '100%' })}>
      <h3 className="page-heading">Service map</h3>

      <div className={styles.infoText}>
        To allow querying service map data you have to select a Prometheus instance where the data is stored.
      </div>

      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="The Prometheus data source with the service map data" label="Data source" labelWidth={26}>
          <DataSourcePicker
            pluginId="prometheus"
            current={options.jsonData.serviceMap?.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'serviceMap', {
                datasourceUid: ds.uid,
              })
            }
          />
        </InlineField>
        <Button
          type={'button'}
          variant={'secondary'}
          size={'sm'}
          fill={'text'}
          onClick={() => {
            updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'serviceMap', {
              datasourceUid: undefined,
            });
          }}
        >
          Clear
        </Button>
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
