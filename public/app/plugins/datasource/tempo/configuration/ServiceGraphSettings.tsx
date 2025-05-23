import {
  DataSourceInstanceSettings,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, useStyles2, Combobox } from '@grafana/ui';

import { TempoJsonData } from '../types';

import { getStyles } from './QuerySettings';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function ServiceGraphSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  const histogramOptions = [
    { label: 'Classic', value: 'classic' },
    { label: 'Native', value: 'native' },
    { label: 'Both', value: 'both' },
  ];

  return (
    <div className={styles.container}>
      <InlineFieldRow className={styles.row}>
        <InlineField
          tooltip="The Prometheus data source with the service graph data"
          label="Data source"
          labelWidth={26}
        >
          <DataSourcePicker
            inputId="service-graph-data-source-picker"
            pluginId="prometheus"
            current={options.jsonData.serviceMap?.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds: DataSourceInstanceSettings) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'serviceMap', {
                datasourceUid: ds.uid,
              })
            }
          />
        </InlineField>
        {options.jsonData.serviceMap?.datasourceUid ? (
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
        ) : null}
      </InlineFieldRow>
      <InlineFieldRow className={styles.row}>
        <InlineField
          tooltip="Select which type of histograms are configured in Tempo and Prometheus"
          label="Histogram type"
          labelWidth={26}
        >
          <Combobox
            id="histogram-type-select"
            value={options.jsonData.serviceMap?.histogramType || 'classic'}
            width={40}
            options={histogramOptions}
            onChange={(value) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'serviceMap', {
                ...options.jsonData.serviceMap,
                histogramType: value.value,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}
