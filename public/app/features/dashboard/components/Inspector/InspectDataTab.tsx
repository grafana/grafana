import React, { PureComponent } from 'react';
import {
  applyFieldOverrides,
  DataFrame,
  DataTransformerID,
  FieldType,
  getDisplayProcessor,
  getFrameDisplayTitle,
  SelectableValue,
  toCSV,
  transformDataFrame,
} from '@grafana/data';
import {
  Button,
  Container,
  Field,
  HorizontalGroup,
  Icon,
  LegacyForms,
  Select,
  Table,
  VerticalGroup,
} from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import AutoSizer from 'react-virtualized-auto-sizer';

import { getPanelInspectorStyles } from './styles';
import { config } from 'app/core/config';
import { saveAs } from 'file-saver';
import { css } from 'emotion';
import { GetDataOptions } from '../../state/PanelQueryRunner';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

const { Switch } = LegacyForms;

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
  data: DataFrame[];
  isLoading: boolean;
  options: GetDataOptions;
  onOptionsChange: (options: GetDataOptions) => void;
}

interface State {
  transformId: DataTransformerID;
  dataFrameIndex: number;
  transformationOptions: Array<SelectableValue<string>>;
}

export class InspectDataTab extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      dataFrameIndex: 0,
      transformId: DataTransformerID.noop,
      transformationOptions: buildTransformationOptions(),
    };
  }

  exportCsv = (dataFrame: DataFrame) => {
    const dataFrameCsv = toCSV([dataFrame]);

    const blob = new Blob([dataFrameCsv], {
      type: 'application/csv;charset=utf-8',
    });

    saveAs(blob, dataFrame.name + '-' + new Date().getUTCDate() + '.csv');
  };

  onSelectedFrameChanged = (item: SelectableValue<number>) => {
    this.setState({ dataFrameIndex: item.value || 0 });
  };

  onTransformationChange = (value: SelectableValue<DataTransformerID>) => {
    this.setState({ transformId: value.value, dataFrameIndex: 0 });
  };

  getTransformedData(): DataFrame[] {
    const { transformId, transformationOptions } = this.state;
    const { data } = this.props;

    if (!data) {
      return [];
    }

    const currentTransform = transformationOptions.find(item => item.value === transformId);

    if (currentTransform && currentTransform.transformer.id !== DataTransformerID.noop) {
      return transformDataFrame([currentTransform.transformer], data);
    }
    return data;
  }

  applyTimeFormatting = (data: DataFrame[]): DataFrame[] => {
    for (const frame of data) {
      for (const field of frame.fields) {
        if (field.type == FieldType.time) {
          field.display = getDisplayProcessor({
            field,
            theme: config.theme,
          });
        }
      }
    }

    return data;
  };
  getProcessedData(): DataFrame[] {
    if (this.state.transformId === DataTransformerID.noop) {
      return this.applyTimeFormatting(this.props.data);
    }

    const data = this.getTransformedData();

    // We need to apply field config even though it was already applied in the PanelQueryRunner.
    // That's because transformers create new fields and data frames, so i.e. display processor is no longer there
    return this.props.options.applyFieldConfig
      ? applyFieldOverrides({
          data,
          theme: config.theme,
          fieldConfig: this.props.panel.fieldConfig,
          replaceVariables: (value: string) => {
            return value;
          },
        })
      : this.applyTimeFormatting(data);
  }

  render() {
    const { isLoading, data, options, onOptionsChange } = this.props;
    const { dataFrameIndex, transformId, transformationOptions } = this.state;
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

    const choices = dataFrames.map((frame, index) => {
      return {
        value: index,
        label: `${getFrameDisplayTitle(frame)} (${index})`,
      };
    });

    const panelTransformations = this.props.panel.getTransformations();

    return (
      <div className={styles.dataTabContent} aria-label={selectors.components.PanelInspector.Data.content}>
        <Container>
          <VerticalGroup spacing={'md'}>
            <HorizontalGroup justify={'space-between'} align={'flex-end'} wrap>
              <HorizontalGroup>
                {data.length > 1 && (
                  <Container grow={1}>
                    <Field
                      label="Transformer"
                      className={css`
                        margin-bottom: 0;
                      `}
                    >
                      <Select
                        options={transformationOptions}
                        value={transformId}
                        onChange={this.onTransformationChange}
                        width={15}
                      />
                    </Field>
                  </Container>
                )}
                {choices.length > 1 && (
                  <Container grow={1}>
                    <Field
                      label="Select result"
                      className={css`
                        margin-bottom: 0;
                      `}
                    >
                      <Select options={choices} value={dataFrameIndex} onChange={this.onSelectedFrameChanged} />
                    </Field>
                  </Container>
                )}
              </HorizontalGroup>

              <Button variant="primary" onClick={() => this.exportCsv(dataFrames[dataFrameIndex])}>
                Download CSV
              </Button>
            </HorizontalGroup>
            <Container grow={1}>
              <QueryOperationRow title={'Data display options'} isOpen={false}>
                {panelTransformations && panelTransformations.length > 0 && (
                  <div className="gf-form-inline">
                    <Switch
                      tooltip="Data shown in the table will be transformed using transformations defined in the panel"
                      label="Apply panel transformations"
                      labelClass="width-12"
                      checked={!!options.transform}
                      onChange={() => onOptionsChange({ ...options, transform: !options.transform })}
                    />
                  </div>
                )}
                <div className="gf-form-inline">
                  <Switch
                    tooltip="Data shown in the table will have panel field configuration applied, for example units or title"
                    label="Apply field configuration"
                    labelClass="width-12"
                    checked={!!options.applyFieldConfig}
                    onChange={() => onOptionsChange({ ...options, applyFieldConfig: !options.applyFieldConfig })}
                  />
                </div>
              </QueryOperationRow>
            </Container>
          </VerticalGroup>
        </Container>

        <div style={{ flexGrow: 1 }}>
          <AutoSizer>
            {({ width, height }) => {
              if (width === 0) {
                return null;
              }

              return (
                <div style={{ width, height }}>
                  <Table width={width} height={height} data={dataFrames[dataFrameIndex]} />
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
  const transformations: Array<SelectableValue<string>> = [
    {
      value: 'Do nothing',
      label: 'None',
      transformer: {
        id: DataTransformerID.noop,
      },
    },
    {
      value: 'join by time',
      label: 'Join by time',
      transformer: {
        id: DataTransformerID.seriesToColumns,
        options: { byField: 'Time' },
      },
    },
  ];

  return transformations;
}
