import { cloneDeep } from 'lodash';
import { PureComponent } from 'react';
import AutoSizer, { type Size } from 'react-virtualized-auto-sizer';

import {
  applyFieldOverrides,
  applyRawFieldOverrides,
  type CoreApp,
  type DataFrame,
  DataTransformerID,
  type FieldConfigSource,
  type SelectableValue,
  type TimeZone,
  transformDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { Button, Spinner, Table } from '@grafana/ui';
import { type GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { dataFrameToLogsModel } from '../logs/logsModel';

import { InspectDataOptions } from './InspectDataOptions';
import { getPanelInspectorStyles } from './styles';
import { downloadAsJson, downloadDataFrameAsCsv, downloadLogsModelAsTxt, downloadTraceAsJson } from './utils/download';
import { filterDataFrameByRowIndexes } from './utils/utils';

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
  /** Row indexes reflecting the column filter/sort currently applied on the panel's own visualization (not this
   * tab's preview table), when the panel type supports reporting it (e.g. the table panel). Indexes are only
   * meaningful for the frame at `panelFilteredRowIndexesFrameIndex`. */
  panelFilteredRowIndexes?: number[];
  panelFilteredRowIndexesFrameIndex?: number;
}

interface State {
  /** The string is joinByField transformation. Otherwise it is a dataframe index */
  selectedDataFrame: number | DataTransformerID;
  transformId: DataTransformerID;
  dataFrameIndex: number;
  transformationOptions: Array<SelectableValue<DataTransformerID>>;
  transformedData: DataFrame[];
  excelCompatibilityMode: boolean;
}

export class InspectDataTab extends PureComponent<Props, State> {
  /** Row indexes into the currently previewed DataFrame, reflecting any column filter/sort applied in the preview
   * table. Kept as an instance field rather than state since it updates on every keystroke in a filter popup and
   * shouldn't trigger a re-render of this component. */
  filteredRowIndexes?: number[];

  constructor(props: Props) {
    super(props);

    this.state = {
      selectedDataFrame: 0,
      dataFrameIndex: 0,
      transformId: DataTransformerID.noop,
      transformationOptions: buildTransformationOptions(),
      transformedData: props.data ?? [],
      excelCompatibilityMode: false,
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
        const input =
          currentTransform.transformer.id === DataTransformerID.joinByField
            ? moveFirstNonEmptyFrameToFront(this.props.data)
            : this.props.data;
        const subscription = transformDataFrame([currentTransform.transformer], input).subscribe((data) => {
          this.setState({ transformedData: data, selectedDataFrame, dataFrameIndex }, () => subscription.unsubscribe());
        });
        return;
      }

      this.setState({ transformedData: this.props.data });
      return;
    }
  }

  /**
   * Applies the panel's own live column filter (if any) to `dataFrame`, so the preview table - and CSV export
   * derived from it - reflects the same rows the user filtered down to on the dashboard panel itself. It's only
   * valid when it corresponds to the exact frame passed in and no transform has reshaped the data (which can
   * add/remove/reorder rows).
   */
  getPanelFilteredFrame(dataFrame: DataFrame): DataFrame {
    const { panelFilteredRowIndexes, panelFilteredRowIndexesFrameIndex } = this.props;
    const { transformId, dataFrameIndex } = this.state;

    const panelFilterApplies =
      panelFilteredRowIndexes !== undefined &&
      transformId === DataTransformerID.noop &&
      panelFilteredRowIndexesFrameIndex === dataFrameIndex;

    return panelFilterApplies ? filterDataFrameByRowIndexes(dataFrame, panelFilteredRowIndexes) : dataFrame;
  }

  exportCsv(dataFrames: DataFrame[], hasLogs: boolean) {
    const { dataName } = this.props;
    const { transformId, dataFrameIndex } = this.state;

    // this.filteredRowIndexes are indexes into whatever frame the preview table was actually showing, i.e.
    // the panel-filtered frame below - applying it on top keeps both layers of filtering consistent.
    const dataFrame = filterDataFrameByRowIndexes(
      this.getPanelFilteredFrame(dataFrames[dataFrameIndex]),
      this.filteredRowIndexes
    );

    if (hasLogs) {
      reportInteraction('grafana_logs_download_clicked', { app: this.props.app, format: 'csv' });
    }

    downloadDataFrameAsCsv(dataFrame, dataName, {}, transformId, this.state.excelCompatibilityMode);
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
    this.filteredRowIndexes = undefined;
    this.setState({
      transformId:
        item.value === DataTransformerID.joinByField ? DataTransformerID.joinByField : DataTransformerID.noop,
      dataFrameIndex: typeof item.value === 'number' ? item.value : 0,
      selectedDataFrame: item.value!,
    });
  };

  onToggleExcelCompatibilityMode = () => {
    this.setState((prevState) => ({
      excelCompatibilityMode: !prevState.excelCompatibilityMode,
    }));
  };

  onFilteredRowsChange = (rowIndexes: number[]) => {
    this.filteredRowIndexes = rowIndexes;
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
    const { dataFrameIndex, transformationOptions, selectedDataFrame, excelCompatibilityMode } = this.state;
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
            onDataFrameChange={this.onDataFrameChange}
            excelCompatibilityMode={excelCompatibilityMode}
            toggleExcelCompatibilityMode={this.onToggleExcelCompatibilityMode}
            actions={this.renderActions(dataFrames, hasLogs, hasTraces, hasServiceGraph)}
          />
        </div>
        <div className={styles.content}>
          <AutoSizer>
            {({ width, height }: Size) => {
              if (width === 0) {
                return null;
              }

              return (
                <Table
                  width={width}
                  height={height}
                  data={this.getPanelFilteredFrame(dataFrame)}
                  showTypeIcons={true}
                  onFilteredRowsChange={this.onFilteredRowsChange}
                />
              );
            }}
          </AutoSizer>
        </div>
      </div>
    );
  }
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
      transformer: {
        id: DataTransformerID.joinByField,
        options: { byField: undefined }, // defaults to time field
      },
    },
  ];

  return transformations;
}
