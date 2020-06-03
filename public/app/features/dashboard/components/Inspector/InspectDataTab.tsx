import React, { PureComponent } from 'react';
import {
  applyFieldOverrides,
  DataFrame,
  DataTransformerID,
  dateTimeFormat,
  getFrameDisplayName,
  SelectableValue,
  toCSV,
  transformDataFrame,
  getTimeField,
  FieldType,
  FormattedVector,
  DisplayProcessor,
  getDisplayProcessor,
} from '@grafana/data';
import { Button, Field, Icon, LegacyForms, Select, Table } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import AutoSizer from 'react-virtualized-auto-sizer';

import { getPanelInspectorStyles } from './styles';
import { config } from 'app/core/config';
import { saveAs } from 'file-saver';
import { css, cx } from 'emotion';
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
    const { panel } = this.props;
    const { transformId } = this.state;

    // Replace the time field with a formatted time
    const { timeIndex, timeField } = getTimeField(dataFrame);
    if (timeField) {
      // Use the configurd date or standandard time display
      let processor: DisplayProcessor = timeField.display;
      if (!processor) {
        processor = getDisplayProcessor({
          field: timeField,
        });
      }

      const formattedDateField = {
        ...timeField,
        type: FieldType.string,
        values: new FormattedVector(timeField.values, processor),
      };

      const fields = [...dataFrame.fields];
      fields[timeIndex] = formattedDateField;
      dataFrame = {
        ...dataFrame,
        fields,
      };
    }

    const dataFrameCsv = toCSV([dataFrame]);

    const blob = new Blob([dataFrameCsv], {
      type: 'application/csv;charset=utf-8',
    });
    const transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
    const fileName = `${panel.title}-data${transformation}-${dateTimeFormat(new Date())}.csv`;
    saveAs(blob, fileName);
  };

  onSelectedFrameChanged = (item: SelectableValue<number>) => {
    this.setState({ dataFrameIndex: item.value || 0 });
  };

  onTransformationChange = (value: SelectableValue<DataTransformerID>) => {
    this.setState({ transformId: value.value, dataFrameIndex: 0 });
    this.props.onOptionsChange({
      ...this.props.options,
      withTransforms: false,
    });
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

  getProcessedData(): DataFrame[] {
    const { options } = this.props;
    let data = this.props.data;

    if (this.state.transformId !== DataTransformerID.noop) {
      data = this.getTransformedData();
    }

    // We need to apply field config even though it was already applied in the PanelQueryRunner.
    // That's because transformers create new fields and data frames, so i.e. display processor is no longer there
    return applyFieldOverrides({
      data,
      theme: config.theme,
      fieldConfig: options.withFieldConfig ? this.props.panel.fieldConfig : { defaults: {}, overrides: [] },
      replaceVariables: (value: string) => {
        return value;
      },
    });
  }

  renderDataOptions = () => {
    const { options, onOptionsChange, panel } = this.props;
    const { transformId } = this.state;
    const styles = getPanelInspectorStyles();

    const panelTransformations = panel.getTransformations();
    const showPanelTransformationsOption =
      panelTransformations && panelTransformations.length > 0 && (transformId as any) !== 'join by time';
    const showFieldConfigsOption = !panel.plugin?.fieldConfigRegistry.isEmpty();
    const showDataOptions = showPanelTransformationsOption || showFieldConfigsOption;

    if (!showDataOptions) {
      return null;
    }

    return (
      <div className={cx(styles.options, styles.dataDisplayOptions)}>
        <QueryOperationRow title={'Data display options'} isOpen={false}>
          {showPanelTransformationsOption && (
            <div className="gf-form-inline">
              <Switch
                tooltip="Data shown in the table will be transformed using transformations defined in the panel"
                label="Apply panel transformations"
                labelClass="width-12"
                checked={!!options.withTransforms}
                onChange={() => onOptionsChange({ ...options, withTransforms: !options.withTransforms })}
              />
            </div>
          )}
          {showFieldConfigsOption && (
            <div className="gf-form-inline">
              <Switch
                tooltip="Data shown in the table will have panel field configuration applied, for example units or display name"
                label="Apply field configuration"
                labelClass="width-12"
                checked={!!options.withFieldConfig}
                onChange={() => onOptionsChange({ ...options, withFieldConfig: !options.withFieldConfig })}
              />
            </div>
          )}
        </QueryOperationRow>
      </div>
    );
  };

  render() {
    const { isLoading, data } = this.props;
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
        label: `${getFrameDisplayName(frame)} (${index})`,
      };
    });

    return (
      <div className={styles.dataTabContent} aria-label={selectors.components.PanelInspector.Data.content}>
        <div className={styles.actionsWrapper}>
          <div className={styles.leftActions}>
            <div className={styles.selects}>
              {data.length > 1 && (
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
              )}
              {choices.length > 1 && (
                <Field
                  label="Select result"
                  className={css`
                    margin-bottom: 0;
                  `}
                >
                  <Select options={choices} value={dataFrameIndex} onChange={this.onSelectedFrameChanged} width={30} />
                </Field>
              )}
            </div>
            {this.renderDataOptions()}
          </div>

          <div className={styles.options}>
            <Button variant="primary" onClick={() => this.exportCsv(dataFrames[dataFrameIndex])}>
              Download CSV
            </Button>
          </div>
        </div>

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
