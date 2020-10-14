import _ from 'lodash';
import { colors } from '@grafana/ui';
import {
  TimeRange,
  FieldType,
  Field,
  DataFrame,
  getTimeField,
  dateTime,
  getFieldDisplayName,
  getColorForTheme,
} from '@grafana/data';
import TimeSeries from 'app/core/time_series2';
import config from 'app/core/config';

type Options = {
  dataList: DataFrame[];
  range?: TimeRange;
};

export class DataProcessor {
  constructor(private panel: any) {}

  getSeriesList(options: Options): TimeSeries[] {
    const list: TimeSeries[] = [];
    const { dataList, range } = options;

    if (!dataList || !dataList.length) {
      return list;
    }

    for (let i = 0; i < dataList.length; i++) {
      const series = dataList[i];
      const { timeField } = getTimeField(series);

      if (!timeField) {
        continue;
      }

      for (let j = 0; j < series.fields.length; j++) {
        const field = series.fields[j];

        if (field.type !== FieldType.number) {
          continue;
        }
        const name = getFieldDisplayName(field, series, dataList);
        const datapoints = [];

        for (let r = 0; r < series.length; r++) {
          datapoints.push([field.values.get(r), dateTime(timeField.values.get(r)).valueOf()]);
        }

        list.push(this.toTimeSeries(field, name, i, j, datapoints, list.length, range));
      }
    }

    // Merge all the rows if we want to show a histogram
    if (this.panel.xaxis.mode === 'histogram' && !this.panel.stack && list.length > 1) {
      const first = list[0];
      first.alias = first.aliasEscaped = 'Count';

      for (let i = 1; i < list.length; i++) {
        first.datapoints = first.datapoints.concat(list[i].datapoints);
      }

      return [first];
    }

    return list;
  }

  private toTimeSeries(
    field: Field,
    alias: string,
    dataFrameIndex: number,
    fieldIndex: number,
    datapoints: any[][],
    index: number,
    range?: TimeRange
  ) {
    const colorIndex = index % colors.length;
    const color = this.panel.aliasColors[alias] || colors[colorIndex];

    const series = new TimeSeries({
      datapoints: datapoints || [],
      alias: alias,
      color: getColorForTheme(color, config.theme),
      unit: field.config ? field.config.unit : undefined,
      dataFrameIndex,
      fieldIndex,
    });

    if (datapoints && datapoints.length > 0 && range) {
      const last = datapoints[datapoints.length - 1][1];
      const from = range.from;

      if (last - from.valueOf() < -10000) {
        series.isOutsideRange = true;
      }
    }
    return series;
  }

  setPanelDefaultsForNewXAxisMode() {
    switch (this.panel.xaxis.mode) {
      case 'time': {
        this.panel.bars = false;
        this.panel.lines = true;
        this.panel.points = false;
        this.panel.legend.show = true;
        this.panel.tooltip.shared = true;
        this.panel.xaxis.values = [];
        break;
      }
      case 'series': {
        this.panel.bars = true;
        this.panel.lines = false;
        this.panel.points = false;
        this.panel.stack = false;
        this.panel.legend.show = false;
        this.panel.tooltip.shared = false;
        this.panel.xaxis.values = ['total'];
        break;
      }
      case 'histogram': {
        this.panel.bars = true;
        this.panel.lines = false;
        this.panel.points = false;
        this.panel.stack = false;
        this.panel.legend.show = false;
        this.panel.tooltip.shared = false;
        break;
      }
    }
  }

  validateXAxisSeriesValue() {
    switch (this.panel.xaxis.mode) {
      case 'series': {
        if (this.panel.xaxis.values.length === 0) {
          this.panel.xaxis.values = ['total'];
          return;
        }

        const validOptions = this.getXAxisValueOptions({});
        const found: any = _.find(validOptions, { value: this.panel.xaxis.values[0] });
        if (!found) {
          this.panel.xaxis.values = ['total'];
        }
        return;
      }
    }
  }

  getXAxisValueOptions(options: any) {
    switch (this.panel.xaxis.mode) {
      case 'series': {
        return [
          { text: 'Avg', value: 'avg' },
          { text: 'Min', value: 'min' },
          { text: 'Max', value: 'max' },
          { text: 'Total', value: 'total' },
          { text: 'Count', value: 'count' },
        ];
      }
    }

    return [];
  }

  pluckDeep(obj: any, property: string) {
    const propertyParts = property.split('.');
    let value = obj;
    for (let i = 0; i < propertyParts.length; ++i) {
      if (value[propertyParts[i]]) {
        value = value[propertyParts[i]];
      } else {
        return undefined;
      }
    }
    return value;
  }
}
