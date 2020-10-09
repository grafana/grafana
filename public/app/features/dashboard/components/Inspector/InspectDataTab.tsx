import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  applyFieldOverrides,
  applyRawFieldOverrides,
  DataFrame,
  DataTransformerID,
  dateTimeFormat,
  getFrameDisplayName,
  SelectableValue,
  toCSV,
  transformDataFrame,
} from '@grafana/data';
import { Button, Container, Field, HorizontalGroup, Icon, Select, Switch, Table, VerticalGroup } from '@grafana/ui';
import { CSVConfig } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { getPanelInspectorStyles } from './styles';
import { config } from 'app/core/config';
import { saveAs } from 'file-saver';
import { css } from 'emotion';
import { GetDataOptions } from '../../state/PanelQueryRunner';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { PanelModel } from 'app/features/dashboard/state';
import { DetailText } from './DetailText';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';

interface Props {
  panel: PanelModel;
  data?: DataFrame[];
  isLoading: boolean;
  options: GetDataOptions;
  onOptionsChange: (options: GetDataOptions) => void;
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
      const currentTransform = this.state.transformationOptions.find(item => item.value === this.state.transformId);

      if (currentTransform && currentTransform.transformer.id !== DataTransformerID.noop) {
        const selectedDataFrame = this.state.selectedDataFrame;
        const dataFrameIndex = this.state.dataFrameIndex;
        const subscription = transformDataFrame([currentTransform.transformer], this.props.data).subscribe(data => {
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
    const transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
    const fileName = `${panel.title}-data${transformation}-${dateTimeFormat(new Date())}.csv`;
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

  getProcessedData(): DataFrame[] {
    const { options } = this.props;
    const data = this.state.transformedData;

    if (!options.withFieldConfig) {
      return applyRawFieldOverrides(data);
    }

    // We need to apply field config even though it was already applied in the PanelQueryRunner.
    // That's because transformers create new fields and data frames, so i.e. display processor is no longer there
    return applyFieldOverrides({
      data,
      theme: config.theme,
      fieldConfig: this.props.panel.fieldConfig,
      replaceVariables: (value: string) => {
        return value;
      },
      getDataSourceSettingsByUid: getDatasourceSrv().getDataSourceSettingsByUid,
    });
  }

  getActiveString() {
    const { selectedDataFrame } = this.state;
    const { options, data } = this.props;
    let activeString = '';

    if (!data) {
      return activeString;
    }

    const parts: string[] = [];

    if (selectedDataFrame === DataTransformerID.seriesToColumns) {
      parts.push('Series joined by time');
    } else if (data.length > 1) {
      parts.push(getFrameDisplayName(data[selectedDataFrame as number]));
    }

    if (options.withTransforms || options.withFieldConfig) {
      if (options.withTransforms) {
        parts.push('Panel transforms');
      }

      if (options.withTransforms && options.withFieldConfig) {
      }

      if (options.withFieldConfig) {
        parts.push('Formatted data');
      }
    }

    if (this.state.downloadForExcel) {
      parts.push('Excel header');
    }

    return parts.join(', ');
  }

  renderDataOptions(dataFrames: DataFrame[]) {
    const { options, onOptionsChange, panel, data } = this.props;
    const { transformId, transformationOptions, selectedDataFrame } = this.state;

    const styles = getPanelInspectorStyles();

    const panelTransformations = panel.getTransformations();
    const showPanelTransformationsOption =
      panelTransformations && panelTransformations.length > 0 && (transformId as any) !== 'join by time';
    const showFieldConfigsOption = !panel.plugin?.fieldConfigRegistry.isEmpty();
    const showDataOptions = showPanelTransformationsOption || showFieldConfigsOption;

    let dataSelect = dataFrames;
    if (selectedDataFrame === DataTransformerID.seriesToColumns) {
      dataSelect = data!;
    }

    const choices = dataSelect.map((frame, index) => {
      return {
        value: index,
        label: `${getFrameDisplayName(frame)} (${index})`,
      } as SelectableValue<number>;
    });

    const selectableOptions = [...transformationOptions, ...choices];

    if (!showDataOptions) {
      return null;
    }

    return (
      <QueryOperationRow
        id="Data options"
        index={0}
        title="Data options"
        headerElement={<DetailText>{this.getActiveString()}</DetailText>}
        isOpen={false}
      >
        <div className={styles.options}>
          <VerticalGroup spacing="none">
            {data!.length > 1 && (
              <Field label="Show data frame">
                <Select
                  options={selectableOptions}
                  value={selectedDataFrame}
                  onChange={this.onDataFrameChange}
                  width={30}
                />
              </Field>
            )}

            <HorizontalGroup>
              {showPanelTransformationsOption && (
                <Field
                  label="Apply panel transformations"
                  description="Table data is displayed with transformations defined in the panel Transform tab."
                >
                  <Switch
                    value={!!options.withTransforms}
                    onChange={() => onOptionsChange({ ...options, withTransforms: !options.withTransforms })}
                  />
                </Field>
              )}
              {showFieldConfigsOption && (
                <Field
                  label="Formatted data"
                  description="Table data is formatted with options defined in the Field and Override tabs."
                >
                  <Switch
                    value={!!options.withFieldConfig}
                    onChange={() => onOptionsChange({ ...options, withFieldConfig: !options.withFieldConfig })}
                  />
                </Field>
              )}
              <Field label="Download for Excel" description="Adds header to CSV for use with Excel">
                <Switch
                  value={this.state.downloadForExcel}
                  onChange={() => this.setState({ downloadForExcel: !this.state.downloadForExcel })}
                />
              </Field>
            </HorizontalGroup>
          </VerticalGroup>
        </div>
      </QueryOperationRow>
    );
  }

  render() {
    const { isLoading } = this.props;
    const { dataFrameIndex } = this.state;
    const styles = getPanelInspectorStyles();

    if (isLoading) {
      return (
        <div>
          Loading <Icon name="fa fa-spinner" className="fa-spin" size="lg" />
        </div>
      );
    }

    const dataFrames = this.getProcessedData();

    if (!dataFrames || !dataFrames.length) {
      return <div>No Data</div>;
    }

    // let's make sure we don't try to render a frame that doesn't exists
    const index = !dataFrames[dataFrameIndex] ? 0 : dataFrameIndex;
    const data = dataFrames[index];

    return (
      <div className={styles.dataTabContent} aria-label={selectors.components.PanelInspector.Data.content}>
        <div className={styles.actionsWrapper}>
          <div className={styles.dataDisplayOptions}>{this.renderDataOptions(dataFrames)}</div>
          <Button
            variant="primary"
            onClick={() => this.exportCsv(dataFrames[dataFrameIndex], { useExcelHeader: this.state.downloadForExcel })}
            className={css`
              margin-bottom: 10px;
            `}
          >
            Download CSV
          </Button>
        </div>
        <Container grow={1}>
          <AutoSizer>
            {({ width, height }) => {
              if (width === 0) {
                return null;
              }

              return (
                <div style={{ width, height }}>
                  <Table width={width} height={height} data={data} />
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
