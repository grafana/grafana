import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  applyFieldOverrides,
  applyRawFieldOverrides,
  CSVConfig,
  DataFrame,
  DataTransformerID,
  dateTimeFormat,
  dateTimeFormatISO,
  SelectableValue,
  toCSV,
  transformDataFrame,
} from '@grafana/data';
import { Button, Container, Spinner, Table } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { InspectDataOptions } from './InspectDataOptions';
import { getPanelInspectorStyles } from './styles';
import { config } from 'app/core/config';
import { saveAs } from 'file-saver';
import { css } from '@emotion/css';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';
import { PanelModel } from 'app/features/dashboard/state';
import { dataFrameToLogsModel } from 'app/core/logs_model';

interface Props {
  isLoading: boolean;
  options: GetDataOptions;
  data?: DataFrame[];
  panel?: PanelModel;
  onOptionsChange?: (options: GetDataOptions) => void;
}

interface State {
  /** The string is seriesToColumns transformation. Otherwise it is a dataframe index */
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

    const dataFrameCsv = toCSV([dataFrame], csvConfig);

    const blob = new Blob([String.fromCharCode(0xfeff), dataFrameCsv], {
      type: 'text/csv;charset=utf-8',
    });
    const displayTitle = panel ? panel.getDisplayTitle() : 'Explore';
    const transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
    const fileName = `${displayTitle}-data${transformation}-${dateTimeFormat(new Date())}.csv`;
    saveAs(blob, fileName);
  };

  exportLogsAsTxt = () => {
    const { data, panel } = this.props;
    const logsModel = dataFrameToLogsModel(data || [], undefined);
    let textToDownload = '';

    logsModel.meta?.forEach((metaItem) => {
      const string = `${metaItem.label}: ${JSON.stringify(metaItem.value)}\n`;
      textToDownload = textToDownload + string;
    });
    textToDownload = textToDownload + '\n\n';

    logsModel.rows.forEach((row) => {
      const newRow = dateTimeFormatISO(row.timeEpochMs) + '\t' + row.entry + '\n';
      textToDownload = textToDownload + newRow;
    });

    const blob = new Blob([textToDownload], {
      type: 'text/plain;charset=utf-8',
    });
    const displayTitle = panel ? panel.getDisplayTitle() : 'Explore';
    const fileName = `${displayTitle}-logs-${dateTimeFormat(new Date())}.txt`;
    saveAs(blob, fileName);
  };

  onDataFrameChange = (item: SelectableValue<DataTransformerID | number>) => {
    this.setState({
      transformId:
        item.value === DataTransformerID.seriesToColumns ? DataTransformerID.seriesToColumns : DataTransformerID.noop,
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
    const { options, panel } = this.props;
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
      replaceVariables: (value: string) => {
        return value;
      },
    });
  }

  render() {
    const { isLoading, options, data, panel, onOptionsChange } = this.props;
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

    return (
      <div className={styles.dataTabContent} aria-label={selectors.components.PanelInspector.Data.content}>
        <div className={styles.actionsWrapper}>
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
            onClick={() => this.exportCsv(dataFrames[dataFrameIndex], { useExcelHeader: this.state.downloadForExcel })}
            className={css`
              margin-bottom: 10px;
            `}
          >
            Download CSV
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
              Download logs
            </Button>
          )}
        </div>
        <Container grow={1}>
          <AutoSizer>
            {({ width, height }) => {
              if (width === 0) {
                return null;
              }

              return (
                <div style={{ width, height }}>
                  <Table width={width} height={height} data={dataFrame} />
                </div>
              );
            }}
          </AutoSizer>
        </Container>
      </div>
    );
  }
}

function buildTransformationOptions() {
  const transformations: Array<SelectableValue<DataTransformerID>> = [
    {
      value: DataTransformerID.seriesToColumns,
      label: 'Series joined by time',
      transformer: {
        id: DataTransformerID.seriesToColumns,
        options: { byField: 'Time' },
      },
    },
  ];

  return transformations;
}
