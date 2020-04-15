import React, { PureComponent } from 'react';
import {
  DataFrame,
  applyFieldOverrides,
  toCSV,
  SelectableValue,
  DataTransformerID,
  standardTransformers,
} from '@grafana/data';
import { Button, Select, Icon, Table, Field } from '@grafana/ui';
import { getPanelInspectorStyles } from './styles';
import { config } from 'app/core/config';
import AutoSizer from 'react-virtualized-auto-sizer';
import { saveAs } from 'file-saver';
import { cx } from 'emotion';

interface Props {
  data: DataFrame[];
  isLoading: boolean;
}

interface State {
  transformation?: DataTransformerID;
  dataFrameIndex: number;
}

export class InspectDataTab extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      dataFrameIndex: 0,
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

  getTransformationOptions() {
    const seriesToColumns = standardTransformers.seriesToColumnsTransformer;
    const transformations: Array<SelectableValue<DataTransformerID>> = [
      { value: DataTransformerID.noop, label: 'None' },
      { value: DataTransformerID.seriesToColumns, label: seriesToColumns.name },
    ];

    return transformations;
  }

  onTransformationChange(value: SelectableValue<DataTransformerID>) {
    this.setState({ transformation: value.value });
  }

  render() {
    const { data, isLoading } = this.props;
    const { dataFrameIndex, transformation } = this.state;

    const styles = getPanelInspectorStyles();

    if (isLoading) {
      return (
        <div>
          Loading <Icon name="fa fa-spinner" className="fa-spin" size="lg" />
        </div>
      );
    }

    if (!data || !data.length) {
      return <div>No Data</div>;
    }

    const choices = data.map((frame, index) => {
      return {
        value: index,
        label: `${frame.name} (${index})`,
      };
    });

    const processed = applyFieldOverrides({
      data,
      theme: config.theme,
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (value: string) => {
        return value;
      },
    });

    return (
      <div className={styles.dataTabContent}>
        <div className={styles.toolbar}>
          <Field label="Transformer" className="flex-grow-1">
            <Select
              options={this.getTransformationOptions()}
              value={transformation}
              onChange={this.onTransformationChange}
            />
          </Field>
          {choices.length > 1 && (
            <Field label="Select result" className={cx(styles.toolbarItem, 'flex-grow-1')}>
              <Select options={choices} value={dataFrameIndex} onChange={this.onSelectedFrameChanged} />
            </Field>
          )}
          <div className={styles.downloadCsv}>
            <Button variant="primary" onClick={() => this.exportCsv(processed[dataFrameIndex])}>
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
                  <Table width={width} height={height} data={processed[dataFrameIndex]} />
                </div>
              );
            }}
          </AutoSizer>
        </div>
      </div>
    );
  }
}
