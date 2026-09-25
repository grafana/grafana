import { cloneDeep } from 'lodash';
import { memo, useEffect, useState } from 'react';
import AutoSizer, { type Size } from 'react-virtualized-auto-sizer';

import {
  applyFieldOverrides,
  applyRawFieldOverrides,
  cacheFieldDisplayNames,
  type CoreApp,
  type DataFrame,
  DataTransformerID,
  type FieldConfigSource,
  type SelectableValue,
  transformDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { type TimeZone } from '@grafana/schema';
import { Button, Spinner, Table, useStyles2 } from '@grafana/ui';
import { type GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { dataFrameToLogsModel } from '../logs/logsModel';
import { CommonTableNG } from '../table/CommonTableNG';

import { InspectDataOptions } from './InspectDataOptions';
import { getPanelInspectorStyles2 } from './styles';
import { downloadAsJson, downloadDataFrameAsCsv, downloadLogsModelAsTxt, downloadTraceAsJson } from './utils/download';

interface Props {
  isLoading: boolean;
  options: GetDataOptions;
  timeZone: TimeZone;
  app?: CoreApp;
  data?: DataFrame[];
  /** The title of the panel or other context name */
  dataName: string;
  panelPluginId?: string;
  fieldConfig?: FieldConfigSource;
  hasTransformations?: boolean;
  formattedDataDescription?: string;
  onOptionsChange?: (options: GetDataOptions) => void;
  /** Renders the data with TableNG instead of the legacy Table (TableRT), gated by the table.inspectDataTableNG feature toggle */
  useTableNG?: boolean;
}

const joinByFieldTransformer = {
  id: DataTransformerID.joinByField,
  options: { byField: undefined }, // defaults to time field
};

export const InspectDataTab = memo(function InspectDataTab({
  isLoading,
  options,
  timeZone,
  app,
  data,
  dataName,
  panelPluginId,
  fieldConfig,
  hasTransformations,
  formattedDataDescription,
  onOptionsChange,
  useTableNG,
}: Props) {
  /** The string is joinByField transformation. Otherwise it is a dataframe index */
  const [selectedDataFrame, setSelectedDataFrame] = useState<number | DataTransformerID>(0);
  const [dataFrameIndex, setDataFrameIndex] = useState(0);
  const [transformId, setTransformId] = useState(DataTransformerID.noop);
  const [transformationOptions] = useState(buildTransformationOptions);
  const [joined, setJoined] = useState<{ input: DataFrame[]; frames: DataFrame[] }>();
  const [excelCompatibilityMode, setExcelCompatibilityMode] = useState(false);
  const styles = useStyles2(getPanelInspectorStyles2);

  const shouldJoin = !!data && !options.withTransforms && transformId === DataTransformerID.joinByField;

  useEffect(() => {
    if (!data || !shouldJoin) {
      return;
    }
    const subscription = transformDataFrame([joinByFieldTransformer], moveFirstNonEmptyFrameToFront(data)).subscribe(
      (frames) => setJoined({ input: data, frames })
    );
    return () => subscription.unsubscribe();
  }, [data, shouldJoin]);

  // The join resolves asynchronously, so only use a result computed from the current data
  const transformedData = !data ? [] : shouldJoin && joined?.input === data ? joined.frames : data;

  const exportCsv = (dataFrames: DataFrame[]) => {
    const dataFrame = dataFrames[dataFrameIndex];

    downloadDataFrameAsCsv(dataFrame, dataName, {}, transformId, excelCompatibilityMode);
  };

  const onExportLogsAsTxt = () => {
    reportInteraction('grafana_logs_download_logs_clicked', {
      app,
      format: 'logs',
      area: 'inspector',
    });

    const logsModel = dataFrameToLogsModel(data || []);
    downloadLogsModelAsTxt(logsModel, dataName);
  };

  const onExportTracesAsJson = () => {
    if (!data) {
      return;
    }

    for (const df of data) {
      // Only export traces
      if (df.meta?.preferredVisualisationType !== 'trace') {
        continue;
      }

      const traceFormat = downloadTraceAsJson(df, dataName + '-traces');

      reportInteraction('grafana_traces_download_traces_clicked', {
        app,
        grafana_version: config.buildInfo.version,
        trace_format: traceFormat,
        location: 'inspector',
      });
    }
  };

  const onExportServiceGraph = () => {
    reportInteraction('grafana_traces_download_service_graph_clicked', {
      app,
      grafana_version: config.buildInfo.version,
      location: 'inspector',
    });

    if (!data) {
      return;
    }

    downloadAsJson(data, dataName);
  };

  const onDataFrameChange = (item: SelectableValue<DataTransformerID | number>) => {
    setTransformId(
      item.value === DataTransformerID.joinByField ? DataTransformerID.joinByField : DataTransformerID.noop
    );
    setDataFrameIndex(typeof item.value === 'number' ? item.value : 0);
    setSelectedDataFrame(item.value!);
  };

  const onToggleExcelCompatibilityMode = () => {
    setExcelCompatibilityMode((prev) => !prev);
  };

  const getProcessedData = (): DataFrame[] => {
    if (!options.withFieldConfig) {
      const rawOverriddenData = applyRawFieldOverrides(transformedData);
      cacheFieldDisplayNames(rawOverriddenData);
      return rawOverriddenData;
    }

    let fieldConfigCleaned = fieldConfig ?? { defaults: {}, overrides: [] };
    // Because we visualize this data in a table we have to remove any custom table display settings
    if (panelPluginId === 'table' && fieldConfig) {
      fieldConfigCleaned = cleanTableConfigFromFieldConfig(fieldConfig);
    }

    // We need to apply field config as it's not done by PanelQueryRunner (even when withFieldConfig is true).
    // It's because transformers create new fields and data frames, and we need to clean field config of any table settings.
    const overriddenData = applyFieldOverrides({
      data: transformedData,
      theme: config.theme2,
      fieldConfig: fieldConfigCleaned,
      timeZone,
      replaceVariables: (value, scopedVars, format) => getTemplateSrv().replace(value, scopedVars, format),
    });
    // applyFieldOverrides always clears any previously cached displayName (it can change during the
    // override process), so caching has to happen here on its output — caching transformedData
    // beforehand would just get wiped out again.
    cacheFieldDisplayNames(overriddenData);
    return overriddenData;
  };

  const renderActions = (dataFrames: DataFrame[], hasLogs: boolean, hasTraces: boolean, hasServiceGraph: boolean) => {
    return (
      <>
        <Button variant="primary" onClick={() => exportCsv(dataFrames)} size="sm">
          <Trans i18nKey="dashboard.inspect-data.download-csv">Download CSV</Trans>
        </Button>
        {hasLogs && !config.exploreHideLogsDownload && (
          <Button variant="primary" onClick={onExportLogsAsTxt} size="sm">
            <Trans i18nKey="dashboard.inspect-data.download-logs">Download logs</Trans>
          </Button>
        )}
        {hasTraces && (
          <Button variant="primary" onClick={onExportTracesAsJson} size="sm">
            <Trans i18nKey="dashboard.inspect-data.download-traces">Download traces</Trans>
          </Button>
        )}
        {hasServiceGraph && (
          <Button variant="primary" onClick={onExportServiceGraph} size="sm">
            <Trans i18nKey="dashboard.inspect-data.download-service">Download service graph</Trans>
          </Button>
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div>
        <Spinner inline={true} /> <Trans i18nKey="inspector.inspect-data-tab.loading">Loading</Trans>
      </div>
    );
  }

  const dataFrames = getProcessedData();

  if (!dataFrames || !dataFrames.length) {
    return (
      <div>
        <Trans i18nKey="inspector.inspect-data-tab.no-data">No data</Trans>
      </div>
    );
  }

  // let's make sure we don't try to render a frame that doesn't exists
  const index = !dataFrames[dataFrameIndex] ? 0 : dataFrameIndex;
  const dataFrame = dataFrames[index];
  const hasLogs = dataFrames.some((df) => df?.meta?.preferredVisualisationType === 'logs');
  const hasTraces = dataFrames.some((df) => df?.meta?.preferredVisualisationType === 'trace');
  const hasServiceGraph = dataFrames.some((df) => df?.meta?.preferredVisualisationType === 'nodeGraph');

  return (
    <div className={styles.wrap} data-testid={selectors.components.PanelInspector.Data.content}>
      <div className={styles.toolbar}>
        <InspectDataOptions
          data={data}
          hasTransformations={hasTransformations}
          options={options}
          dataFrames={dataFrames}
          transformationOptions={transformationOptions}
          selectedDataFrame={selectedDataFrame}
          formattedDataDescription={formattedDataDescription}
          onOptionsChange={onOptionsChange}
          onDataFrameChange={onDataFrameChange}
          excelCompatibilityMode={excelCompatibilityMode}
          toggleExcelCompatibilityMode={onToggleExcelCompatibilityMode}
          actions={renderActions(dataFrames, hasLogs, hasTraces, hasServiceGraph)}
        />
      </div>
      <div className={styles.content}>
        <AutoSizer>
          {({ width, height }: Size) => {
            if (width === 0) {
              return null;
            }

            if (useTableNG) {
              // TableNG sizes its grid to its DOM container rather than to these props,
              // so it needs an explicitly-sized wrapper here (unlike the legacy Table).
              return (
                <div style={{ width, height }}>
                  <CommonTableNG
                    width={width}
                    height={height}
                    data={dataFrame}
                    showTypeIcons={true}
                    transparent={config.theme2.flags.visualDesignRefresh}
                  />
                </div>
              );
            }

            return <Table width={width} height={height} data={dataFrame} showTypeIcons={true} />;
          }}
        </AutoSizer>
      </div>
    </div>
  );
});

// Because we visualize this data in a table we have to remove any custom table display settings
function cleanTableConfigFromFieldConfig(fieldConfig: FieldConfigSource): FieldConfigSource {
  fieldConfig = cloneDeep(fieldConfig);
  // clear all table specific options
  fieldConfig.defaults.custom = {};

  // clear all table override properties
  for (const override of fieldConfig.overrides) {
    for (const prop of override.properties) {
      if (prop.id.startsWith('custom.')) {
        const index = override.properties.indexOf(prop);
        override.properties.slice(index, 1);
      }
    }
  }

  return fieldConfig;
}

function moveFirstNonEmptyFrameToFront(frames: DataFrame[]): DataFrame[] {
  const idx = frames.findIndex((f) => f?.fields?.length);
  if (idx <= 0) {
    return frames;
  }
  return [frames[idx], ...frames.slice(0, idx), ...frames.slice(idx + 1)];
}

function buildTransformationOptions() {
  const transformations: Array<SelectableValue<DataTransformerID>> = [
    {
      value: DataTransformerID.joinByField,
      label: t('dashboard.inspect-data.transformation', 'Series joined by time'),
      transformer: joinByFieldTransformer,
    },
  ];

  return transformations;
}
