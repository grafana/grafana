import React, { PureComponent } from 'react';
import { DataFrame, applyFieldOverrides, toCSV, SelectableValue } from '@grafana/data';
import { Button, Select, Icon, Table } from '@grafana/ui';
import { getPanelInspectorStyles } from './styles';
import { config } from 'app/core/config';
import AutoSizer from 'react-virtualized-auto-sizer';
import { saveAs } from 'file-saver';

interface Props {
  data: DataFrame[];
  dataFrameIndex: number;
  isLoading: boolean;
  onSelectedFrameChanged: (item: SelectableValue<number>) => void;
}

export class InspectDataTab extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  exportCsv = (dataFrame: DataFrame) => {
    const dataFrameCsv = toCSV([dataFrame]);

    const blob = new Blob([dataFrameCsv], {
      type: 'application/csv;charset=utf-8',
    });

    saveAs(blob, dataFrame.name + '-' + new Date().getUTCDate() + '.csv');
  };

  render() {
    const { data, dataFrameIndex, isLoading, onSelectedFrameChanged } = this.props;
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
          {choices.length > 1 && (
            <div className={styles.dataFrameSelect}>
              <Select options={choices} value={dataFrameIndex} onChange={onSelectedFrameChanged} />
            </div>
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
