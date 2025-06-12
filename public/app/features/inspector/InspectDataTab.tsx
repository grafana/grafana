import { cloneDeep } from 'lodash';
import { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  applyFieldOverrides,
  applyRawFieldOverrides,
  CoreApp,
  DataFrame,
  DataTransformerID,
  FieldConfigSource,
  SelectableValue,
  TimeZone,
  transformDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { Button, Spinner, Table } from '@grafana/ui';
import { config } from 'app/core/config';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { dataFrameToLogsModel } from '../logs/logsModel';

import { InspectDataOptions } from './InspectDataOptions';
import { getPanelInspectorStyles } from './styles';
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
}

interface State {
  /** The string is joinByField transformation. Otherwise it is a dataframe index */
  selectedDataFrame: number | DataTransformerID;
  transformId: DataTransformerID;
  dataFrameIndex: number;
  transformationOptions: Array<SelectableValue<DataTransformerID>>;
  transformedData: DataFrame[];
  downloadForExcel: boolean;
}

export class InspectDataTab extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      selectedDataFrame: 0,
      dataFrameIndex: 0,
      transformId: DataTransformerID.noop,
      transformationOptions: buildTransformationOptions(),
      transformedData: props.data ?? [],
      downloadForExcel: false,
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!this.props.data) {
      this.setState({ transformedData: [] });
      return;
    }

    if (this.props.options.withTransforms) {
      this.setState({ transformedData: this.props.data });
      return;
    }

    if (prevProps.data !== this.props.data || prevState.transformId !== this.state.transformId) {
      const currentTransform = this.state.transformationOptions.find((item) => item.value === this.state.transformId);

      if (currentTransform && currentTransform.transformer.id !== DataTransformerID.noop) {
        const selectedDataFrame = this.state.selectedDataFrame;
        const dataFrameIndex = this.state.dataFrameIndex;
        const subscription = transformDataFrame([currentTransform.transformer], this.props.data).subscribe((data) => {
          this.setState({ transformedData: data, selectedDataFrame, dataFrameIndex }, () => subscription.unsubscribe());
        });
        return;
      }

      this.setState({ transformedData: this.props.data });
      return;
    }
  }

  exportCsv(dataFrames: DataFrame[], hasLogs: boolean) {
    const { dataName } = this.props;
    const { transformId } = this.state;
    const dataFrame = dataFrames[this.state.dataFrameIndex];

    if (hasLogs) {
      reportInteraction('grafana_logs_download_clicked', { app: this.props.app, format: 'csv' });
    }

    downloadDataFrameAsCsv(dataFrame, dataName, { useExcelHeader: this.state.downloadForExcel }, transformId);
  }

  onExportLogsAsTxt = () => {
    const { data, dataName, app } = this.props;

    reportInteraction('grafana_logs_download_logs_clicked', {
      app,
      format: 'logs',
      area: 'inspector',
    });

    const logsModel = dataFrameToLogsModel(data || []);
    downloadLogsModelAsTxt(logsModel, dataName);
  };

  onExportTracesAsJson = () => {
    const { data, dataName, app } = this.props;

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

  onExportServiceGraph = () => {
    const { data, dataName, app } = this.props;

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

  onDataFrameChange = (item: SelectableValue<DataTransformerID | number>) => {
    this.setState({
      transformId:
        item.value === DataTransformerID.joinByField ? DataTransformerID.joinByField : DataTransformerID.noop,
      dataFrameIndex: typeof item.value === 'number' ? item.value : 0,
      selectedDataFrame: item.value!,
    });
  };

  onToggleDownloadForExcel = () => {
    this.setState((prevState) => ({
      downloadForExcel: !prevState.downloadForExcel,
    }));
  };

  getProcessedData(): DataFrame[] {
    const { options, panelPluginId, fieldConfig, timeZone } = this.props;
    const data = this.state.transformedData;

    if (!options.withFieldConfig) {
      return applyRawFieldOverrides(data);
    }

    let fieldConfigCleaned = fieldConfig ?? { defaults: {}, overrides: [] };
    // Because we visualize this data in a table we have to remove any custom table display settings
    if (panelPluginId === 'table' && fieldConfig) {
      fieldConfigCleaned = this.cleanTableConfigFromFieldConfig(fieldConfig);
    }

    // We need to apply field config as it's not done by PanelQueryRunner (even when withFieldConfig is true).
    // It's because transformers create new fields and data frames, and we need to clean field config of any table settings.
    return applyFieldOverrides({
      data,
      theme: config.theme2,
      fieldConfig: fieldConfigCleaned,
      timeZone,
      replaceVariables: (value, scopedVars, format) => getTemplateSrv().replace(value, scopedVars, format),
    });
  }

  // Because we visualize this data in a table we have to remove any custom table display settings
  cleanTableConfigFromFieldConfig(fieldConfig: FieldConfigSource): FieldConfigSource {
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

  renderActions(dataFrames: DataFrame[], hasLogs: boolean, hasTraces: boolean, hasServiceGraph: boolean) {
    return (
      <>
        <Button variant="primary" onClick={() => this.exportCsv(dataFrames, hasLogs)} size="sm">
          <Trans i18nKey="dashboard.inspect-data.download-csv">Download CSV</Trans>
        </Button>
        {hasLogs && !config.exploreHideLogsDownload && (
          <Button variant="primary" onClick={this.onExportLogsAsTxt} size="sm">
            <Trans i18nKey="dashboard.inspect-data.download-logs">Download logs</Trans>
          </Button>
        )}
        {hasTraces && (
          <Button variant="primary" onClick={this.onExportTracesAsJson} size="sm">
            <Trans i18nKey="dashboard.inspect-data.download-traces">Download traces</Trans>
          </Button>
        )}
        {hasServiceGraph && (
          <Button variant="primary" onClick={this.onExportServiceGraph} size="sm">
            <Trans i18nKey="dashboard.inspect-data.download-service">Download service graph</Trans>
          </Button>
        )}
      </>
    );
  }

  render() {
    const { isLoading, options, data, formattedDataDescription, onOptionsChange, hasTransformations } = this.props;
    const { dataFrameIndex, transformationOptions, selectedDataFrame, downloadForExcel } = this.state;
    const styles = getPanelInspectorStyles();

    if (isLoading) {
      return (
        <div>
          <Spinner inline={true} /> <Trans i18nKey="inspector.inspect-data-tab.loading">Loading</Trans>
        </div>
      );
    }

    const dataFrames = this.getProcessedData();

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
      <div className={styles.wrap} aria-label={selectors.components.PanelInspector.Data.content}>
        <div className={styles.toolbar}>
          <InspectDataOptions
            data={data}
            hasTransformations={hasTransformations}
            options={options}
            dataFrames={dataFrames}
            transformationOptions={transformationOptions}
            selectedDataFrame={selectedDataFrame}
            downloadForExcel={downloadForExcel}
            formattedDataDescription={formattedDataDescription}
            onOptionsChange={onOptionsChange}
            onDataFrameChange={this.onDataFrameChange}
            toggleDownloadForExcel={this.onToggleDownloadForExcel}
            actions={this.renderActions(dataFrames, hasLogs, hasTraces, hasServiceGraph)}
          />
        </div>
        <div className={styles.content}>
          <AutoSizer>
            {({ width, height }) => {
              if (width === 0) {
                return null;
              }

              return <Table width={width} height={height} data={dataFrame} showTypeIcons={true} />;
            }}
          </AutoSizer>
        </div>
      </div>
    );
  }
}

function buildTransformationOptions() {
  const transformations: Array<SelectableValue<DataTransformerID>> = [
    {
      value: DataTransformerID.joinByField,
      label: t('dashboard.inspect-data.transformation', 'Series joined by time'),
      transformer: {
        id: DataTransformerID.joinByField,
        options: { byField: undefined }, // defaults to time field
      },
    },
  ];

  return transformations;
}
