import React, { Component, ReactNode } from 'react';

import { Select, Table } from '@grafana/ui';
import {
  DataFrame,
  FieldMatcherID,
  FieldType,
  getFrameDisplayName,
  PanelProps,
  SelectableValue,
  Vector,
  vectorator,
  KeyValue,
  formattedValueToString,
  Field,
  DynamicConfigValue,
} from '@grafana/data';
import { PanelOptions } from './models.gen';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { FilterItem, TableSortByFieldState } from '@grafana/ui/src/components/Table/types';
import { dispatch } from '../../../store/store';
import { applyFilterFromTable } from '../../../features/variables/adhoc/actions';
import { getDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';
import { SummaryCell } from './SummaryCell';

interface Props extends PanelProps<PanelOptions> {}

interface Footer {
  cells?: ReactNode[];
  height?: number;
}

export class TablePanel extends Component<Props> {
  footerHeight = undefined;

  constructor(props: Props) {
    super(props);
  }

  onColumnResize = (fieldDisplayName: string, width: number) => {
    const { fieldConfig } = this.props;
    const { overrides } = fieldConfig;

    const matcherId = FieldMatcherID.byName;
    const propId = 'custom.width';

    // look for existing override
    const override = overrides.find((o) => o.matcher.id === matcherId && o.matcher.options === fieldDisplayName);

    if (override) {
      // look for existing property
      const property = override.properties.find((prop) => prop.id === propId);
      if (property) {
        property.value = width;
      } else {
        override.properties.push({ id: propId, value: width });
      }
    } else {
      overrides.push({
        matcher: { id: matcherId, options: fieldDisplayName },
        properties: [{ id: propId, value: width }],
      });
    }

    this.props.onFieldConfigChange({
      ...fieldConfig,
      overrides,
    });
  };

  onSortByChange = (sortBy: TableSortByFieldState[]) => {
    this.props.onOptionsChange({
      ...this.props.options,
      sortBy,
    });
  };

  onChangeTableSelection = (val: SelectableValue<number>) => {
    this.props.onOptionsChange({
      ...this.props.options,
      frameIndex: val.value || 0,
    });

    // Force a redraw -- but no need to re-query
    this.forceUpdate();
  };

  onCellFilterAdded = (filter: FilterItem) => {
    const { key, value, operator } = filter;
    const panelModel = getDashboardSrv().getCurrent()?.getPanelById(this.props.id);
    const datasource = panelModel?.datasource;

    if (!datasource) {
      return;
    }

    dispatch(applyFilterFromTable({ datasource, key, operator, value }));
  };

  renderTable(frame: DataFrame, width: number, height: number) {
    const { options } = this.props;

    const footer = this.getFooter(frame);

    return (
      <Table
        height={height}
        width={width}
        data={frame}
        noHeader={!options.showHeader}
        resizable={true}
        initialSortBy={options.sortBy}
        onSortByChange={this.onSortByChange}
        onColumnResize={this.onColumnResize}
        onCellFilterAdded={this.onCellFilterAdded}
        footerValues={footer.cells}
        footerHeight={footer.height}
      />
    );
  }

  getFooter(frame: DataFrame): Footer {
    const { options } = this.props;

    if (options.footerMode === 'none') {
      return { cells: undefined };
    }

    if (options.footerMode === 'frame') {
      return this.getProvidedFooter(frame);
    }

    if (options.footerMode === 'summary') {
      const summary = options.footerSummary!;
      const fields = options.footerSummary?.fields;
      const cells = frame.fields.map((f, i) => {
        if (fields || fields === '') {
          if (fields.includes('') && f.type === FieldType.number) {
            return this.calculateSummaryCell(i, summary.reducer, f, false);
          }
          if (fields.includes(f.name)) {
            return this.calculateSummaryCell(i, summary.reducer, f, false);
          }
          if (i === 0) {
            return summary.reducer.toUpperCase();
          }
        }
        return;
      });
      return { cells };
    }

    return { cells: undefined };
  }

  // get the footer cells from data provided by another frame
  getProvidedFooter(frame: DataFrame): Footer {
    const { options, data } = this.props;

    const summaryFrame = data.series.find((f) => f.name === options.footerFrame);
    if (summaryFrame === undefined) {
      return { cells: undefined };
    }

    // group cells by field for multi value cells
    const cellsByField: KeyValue = {};
    frame.fields.forEach((f, i) => {
      for (const sf of summaryFrame!.fields) {
        const referenceField: string = sf.config?.custom?.['referenceField'];
        const reducer: string = sf.config?.custom?.['reducer'];
        if (referenceField === f.name) {
          const cell = this.getSummaryCell(i, reducer, sf, true);
          const fieldCells = cellsByField[referenceField] || [];
          fieldCells.push(cell);
          cellsByField[referenceField] = fieldCells;
          continue;
        }
        continue;
      }
    });

    let height: number | undefined;
    const cells = frame.fields.map((f, i) => {
      const fieldCells = cellsByField[f.name];
      if (fieldCells === undefined) {
        if (i === 0) {
          // set the first col val to "Total" if not set
          return 'Total';
        }
        return;
      }
      if (fieldCells.length > 1) {
        const expandedHeight = fieldCells.length * 27;
        height = height || 0;
        if (height < expandedHeight) {
          height = expandedHeight;
        }
      }
      return this.getProvidedList(fieldCells);
    });

    return { cells, height };
  }

  getProvidedList(summaries: ReactNode[]) {
    return (
      <ul style={{ listStyle: 'none', width: '100%' }}>
        {summaries.map((s: ReactNode, idx: number) => {
          return <li key={idx}>{s}</li>;
        })}
      </ul>
    );
  }

  getSummaryList(summaryProps: DynamicConfigValue[], fieldIndex: number, f: Field) {
    const summaries = summaryProps.map((o: any) => {
      return this.calculateSummaryCell(fieldIndex, o.value, f, false);
    });
    return (
      <ul style={{ listStyle: 'none', width: '100%' }}>
        {summaries.map((s: ReactNode, idx: number) => {
          return <li key={idx}>{s}</li>;
        })}
      </ul>
    );
  }

  getSummaryCell(i: number, functionName: string, f: Field, showLabel: boolean) {
    const formatted = this.format(f.values.get(0), f);
    return <SummaryCell key={i} func={functionName} value={formatted} showLabel={showLabel}></SummaryCell>;
  }

  calculateSummaryCell(i: number, functionName: string, f: Field, showLabel: boolean) {
    if (functionName === '') {
      return undefined;
    }

    if (functionName && functionName !== 'avg') {
      const kv = this as KeyValue;
      const func: Function = kv[functionName];
      const val = this.calculate(f.values, func);
      const formatted = this.format(val, f);
      return <SummaryCell key={i} func={functionName} value={formatted} showLabel={showLabel}></SummaryCell>;
    }

    const val = this.mean(f.values);
    const formatted = this.format(val, f) as string;
    return <SummaryCell key={i} func={functionName} value={formatted} showLabel={showLabel}></SummaryCell>;
  }

  format(val: number, f: Field) {
    const displayValue = f.display ? f.display(val) : { text: String(val) };
    return f.display ? formattedValueToString(displayValue) : displayValue.text;
  }

  calculate(values: Vector<any>, func: Function) {
    let calc = 0;
    const itr = vectorator(values);
    for (const v of itr) {
      calc = func(calc, v);
    }
    return calc;
  }

  sum(acc: number, v: number) {
    return (acc += v);
  }

  min(v: number, n: number) {
    return v < n ? v : n;
  }

  max(v: number, n: number) {
    return v > n ? v : n;
  }

  mean(values: Vector<any>) {
    const sum = this.calculate(values, this.sum);
    return sum / values.length;
  }

  getCurrentFrameIndex(frames: DataFrame[]) {
    const { options } = this.props;
    const count = frames.length;
    return options.frameIndex > 0 && options.frameIndex < count ? options.frameIndex : 0;
  }

  render() {
    const { data, height, width, options } = this.props;

    let frames = data.series;
    let count = frames?.length;
    if (options.footerMode === 'frame' && count > 1) {
      frames = frames.filter((f) => f.name !== options.footerFrame);
      count = frames.length;
    }
    const hasFields = frames[0]?.fields.length;

    if (!count || !hasFields) {
      return <div className={tableStyles.noData}>No data</div>;
    }

    if (count > 1) {
      const inputHeight = config.theme.spacing.formInputHeight;
      const padding = 8 * 2;
      const currentIndex = this.getCurrentFrameIndex(frames);
      const names = frames.map((frame, index) => {
        return {
          label: getFrameDisplayName(frame),
          value: index,
        };
      });

      return (
        <div className={tableStyles.wrapper}>
          {this.renderTable(data.series[currentIndex], width, height - inputHeight - padding)}
          <div className={tableStyles.selectWrapper}>
            <Select
              menuShouldPortal
              options={names}
              value={names[currentIndex]}
              onChange={this.onChangeTableSelection}
            />
          </div>
        </div>
      );
    }

    return this.renderTable(data.series[0], width, height - 12);
  }
}

const tableStyles = {
  wrapper: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  `,
  noData: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  `,
  selectWrapper: css`
    padding: 8px;
  `,
};
