import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  applyFieldOverrides,
  applyRawFieldOverrides,
  CoreApp,
  CSVConfig,
  DataFrame,
  DataTransformerID,
  MutableDataFrame,
  SelectableValue,
  TimeZone,
  transformDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, Spinner, Table } from '@grafana/ui';
import { config } from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { dataFrameToLogsModel } from 'app/core/logsModel';
import { PanelModel } from 'app/features/dashboard/state';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';
import { transformToJaeger } from 'app/plugins/datasource/jaeger/responseTransform';
import { transformToOTLP } from 'app/plugins/datasource/tempo/resultTransformer';
import { transformToZipkin } from 'app/plugins/datasource/zipkin/utils/transforms';

import { InspectDataOptions } from './InspectDataOptions';
import { getPanelInspectorStyles } from './styles';
import { downloadAsJson, downloadDataFrameAsCsv, downloadLogsModelAsTxt } from './utils/download';

interface Props {
  isLoading: boolean;
  options: GetDataOptions;
  timeZone: TimeZone;
  app?: CoreApp;
  data?: DataFrame[];
  panel?: PanelModel;
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

  exportCsv = (dataFrame: DataFrame, csvConfig: CSVConfig = {}) => {
    const { panel } = this.props;
    const { transformId } = this.state;

    downloadDataFrameAsCsv(dataFrame, panel ? panel.getDisplayTitle() : 'Explore', csvConfig, transformId);
  };

  exportLogsAsTxt = () => {
    const { data, panel, app } = this.props;

    reportInteraction('grafana_logs_download_logs_clicked', {
      app,
      format: 'logs',
      area: 'inspector',
    });

    const logsModel = dataFrameToLogsModel(data || []);
    downloadLogsModelAsTxt(logsModel, panel ? panel.getDisplayTitle() : 'Explore');
  };

  exportTracesAsJson = () => {
    const { data, panel, app } = this.props;

    if (!data) {
      return;
    }

    for (const df of data) {
      // Only export traces
      if (df.meta?.preferredVisualisationType !== 'trace') {
        continue;
      }
      let traceFormat = 'otlp';

      switch (df.meta?.custom?.traceFormat) {
        case 'jaeger': {
          let res = transformToJaeger(new MutableDataFrame(df));
          downloadAsJson(res, (panel ? panel.getDisplayTitle() : 'Explore') + '-traces');
          traceFormat = 'jaeger';
          break;
        }
        case 'zipkin': {
          let res = transformToZipkin(new MutableDataFrame(df));
          downloadAsJson(res, (panel ? panel.getDisplayTitle() : 'Explore') + '-traces');
          traceFormat = 'zipkin';
          break;
        }
        case 'otlp':
        default: {
          let res = transformToOTLP(new MutableDataFrame(df));
          downloadAsJson(res, (panel ? panel.getDisplayTitle() : 'Explore') + '-traces');
          break;
        }
      }

      reportInteraction('grafana_traces_download_traces_clicked', {
        app,
        grafana_version: config.buildInfo.version,
        trace_format: traceFormat,
        location: 'inspector',
      });
    }
  };

  exportServiceGraph = () => {
    const { data, panel, app } = this.props;
    reportInteraction('grafana_traces_download_service_graph_clicked', {
      app,
      grafana_version: config.buildInfo.version,
      location: 'inspector',
    });

    if (!data) {
      return;
    }

    downloadAsJson(data, panel ? panel.getDisplayTitle() : 'Explore');
  };

  onDataFrameChange = (item: SelectableValue<DataTransformerID | number>) => {
    this.setState({
      transformId:
        item.value === DataTransformerID.joinByField ? DataTransformerID.joinByField : DataTransformerID.noop,
      dataFrameIndex: typeof item.value === 'number' ? item.value : 0,
      selectedDataFrame: item.value!,
    });
  };

  toggleDownloadForExcel = () => {
    this.setState((prevState) => ({
      downloadForExcel: !prevState.downloadForExcel,
    }));
  };

  getProcessedData(): DataFrame[] {
    const { options, panel, timeZone } = this.props;
    const data = this.state.transformedData;

    if (!options.withFieldConfig || !panel) {
      return applyRawFieldOverrides(data);
    }

    // We need to apply field config even though it was already applied in the PanelQueryRunner.
    // That's because transformers create new fields and data frames, so i.e. display processor is no longer there
    return applyFieldOverrides({
      data,
      theme: config.theme2,
      fieldConfig: panel.fieldConfig,
      timeZone,
      replaceVariables: (value: string) => {
        return value;
      },
    });
  }

  render() {
    const { isLoading, options, data, panel, onOptionsChange, app } = this.props;
    const { dataFrameIndex, transformId, transformationOptions, selectedDataFrame, downloadForExcel } = this.state;
    const styles = getPanelInspectorStyles();

    if (isLoading) {
      return (
        <div>
          <Spinner inline={true} /> Loading
        </div>
      );
    }

    const dataFrames = this.getProcessedData();

    if (!dataFrames || !dataFrames.length) {
      return <div>No Data</div>;
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
            panel={panel}
            options={options}
            dataFrames={dataFrames}
            transformId={transformId}
            transformationOptions={transformationOptions}
            selectedDataFrame={selectedDataFrame}
            downloadForExcel={downloadForExcel}
            onOptionsChange={onOptionsChange}
            onDataFrameChange={this.onDataFrameChange}
            toggleDownloadForExcel={this.toggleDownloadForExcel}
          />
          <Button
            variant="primary"
            onClick={() => {
              if (hasLogs) {
                reportInteraction('grafana_logs_download_clicked', {
                  app,
                  format: 'csv',
                });
              }
              this.exportCsv(dataFrames[dataFrameIndex], { useExcelHeader: this.state.downloadForExcel });
            }}
            className={css`
              margin-bottom: 10px;
            `}
          >
            <Trans i18nKey="dashboard.inspect-data.download-csv">Download CSV</Trans>
          </Button>
          {hasLogs && (
            <Button
              variant="primary"
              onClick={this.exportLogsAsTxt}
              className={css`
                margin-bottom: 10px;
                margin-left: 10px;
              `}
            >
              <Trans i18nKey="dashboard.inspect-data.download-logs">Download logs</Trans>
            </Button>
          )}
          {hasTraces && (
            <Button
              variant="primary"
              onClick={this.exportTracesAsJson}
              className={css`
                margin-bottom: 10px;
                margin-left: 10px;
              `}
            >
              <Trans i18nKey="dashboard.inspect-data.download-traces">Download traces</Trans>
            </Button>
          )}
          {hasServiceGraph && (
            <Button
              variant="primary"
              onClick={this.exportServiceGraph}
              className={css`
                margin-bottom: 10px;
                margin-left: 10px;
              `}
            >
              <Trans i18nKey="dashboard.inspect-data.download-service">Download service graph</Trans>
            </Button>
          )}
        </div>
        <div className={styles.content}>
          <AutoSizer>
            {({ width, height }) => {
              if (width === 0) {
                return null;
              }

              return (
                <div style={{ width, height }}>
                  <Table width={width} height={height} data={dataFrame} showTypeIcons={true} />
                </div>
              );
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
