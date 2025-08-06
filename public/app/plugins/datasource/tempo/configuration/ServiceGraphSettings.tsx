import {
  DataSourceInstanceSettings,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, useStyles2, Combobox, TextLink } from '@grafana/ui';

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

  const nativeHistogramDocs = (
    <>
      Select which type of histograms are configured in the {metricsGeneratorDocsLink()}. If native histograms are
      configured, you must also configure native histograms ingestion in {prometheusNativeHistogramsDocsLink()} or{' '}
      {mimirNativeHistogramsDocsLink()}.
    </>
  );

  function metricsGeneratorDocsLink() {
    return (
      <TextLink href="https://grafana.com/docs/tempo/latest/setup-and-configuration/metrics-generator/" external>
        Tempo metrics generator
      </TextLink>
    );
  }

  function prometheusNativeHistogramsDocsLink() {
    return (
      <TextLink href="https://prometheus.io/docs/specs/native_histograms/#native-histograms" external>
        Prometheus
      </TextLink>
    );
  }

  function mimirNativeHistogramsDocsLink() {
    return (
      <TextLink
        href="https://grafana.com/docs/mimir/latest/configure/configure-native-histograms-ingestion/#configure-native-histograms-globally"
        external
      >
        Mimir
      </TextLink>
    );
  }

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
        <InlineField tooltip={nativeHistogramDocs} label="Histogram type" labelWidth={26} interactive={true}>
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
