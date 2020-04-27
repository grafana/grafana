import React, { PureComponent } from 'react';
import {
  applyFieldOverrides,
  DataFrame,
  DataTransformerID,
  SelectableValue,
  toCSV,
  transformDataFrame,
} from '@grafana/data';
import { Button, Field, Icon, Select, Table } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import AutoSizer from 'react-virtualized-auto-sizer';

import { getPanelInspectorStyles } from './styles';
import { config } from 'app/core/config';
import { saveAs } from 'file-saver';
import { cx } from 'emotion';

interface Props {
  data: DataFrame[];
  isLoading: boolean;
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

  getProcessedData(): DataFrame[] {
    return applyFieldOverrides({
      data: this.getTransformedData(),
      theme: config.theme,
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (value: string) => {
        return value;
      },
    });
  }

  render() {
    const { isLoading } = this.props;
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
        label: `${frame.name} (${index})`,
      };
    });

    return (
      <div className={styles.dataTabContent} aria-label={selectors.components.PanelInspector.Data.content}>
        <div className={styles.toolbar}>
          <Field label="Transformer" className="flex-grow-1">
            <Select options={transformationOptions} value={transformId} onChange={this.onTransformationChange} />
          </Field>
          {choices.length > 1 && (
            <Field label="Select result" className={cx(styles.toolbarItem, 'flex-grow-1')}>
              <Select options={choices} value={dataFrameIndex} onChange={this.onSelectedFrameChanged} />
            </Field>
          )}
          <div className={styles.downloadCsv}>
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
