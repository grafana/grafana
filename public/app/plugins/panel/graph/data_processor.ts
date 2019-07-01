import _ from 'lodash';
import { TimeRange, colors, getColorFromHexRgbOrName, FieldCache, FieldType, Field, SeriesData } from '@grafana/ui';
import TimeSeries from 'app/core/time_series2';
import config from 'app/core/config';

type Options = {
  dataList: SeriesData[];
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

    for (const series of dataList) {
      const { fields } = series;
      const cache = new FieldCache(fields);
      const time = cache.getFirstFieldOfType(FieldType.time);

      if (!time) {
        continue;
      }

      const seriesName = series.name ? series.name : series.refId;

      for (let i = 0; i < fields.length; i++) {
        if (fields[i].type !== FieldType.number) {
          continue;
        }

        const field = fields[i];
        let name = field.title;

        if (!field.title) {
          name = field.name;
        }

        if (seriesName && dataList.length > 0 && name !== seriesName) {
          name = seriesName + ' ' + name;
        }

        const datapoints = [];
        for (const row of series.rows) {
          datapoints.push([row[i], row[time.index]]);
        }

        list.push(this.toTimeSeries(field, name, datapoints, list.length, range));
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

  private toTimeSeries(field: Field, alias: string, datapoints: any[][], index: number, range?: TimeRange) {
    const colorIndex = index % colors.length;
    const color = this.panel.aliasColors[alias] || colors[colorIndex];

    const series = new TimeSeries({
      datapoints: datapoints || [],
      alias: alias,
      color: getColorFromHexRgbOrName(color, config.theme.type),
      unit: field.unit,
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
