import _ from 'lodash';
import { colors, getColorFromHexRgbOrName, FieldCache, FieldType, SeriesData, Field } from '@grafana/ui';
import TimeSeries from 'app/core/time_series2';
import config from 'app/core/config';
import { TimeRange } from '@grafana/ui';

type Options = {
  dataList: SeriesData[];
  range?: TimeRange;
};

export class DataProcessor {
  constructor(private panel) {}

  getSeriesList(options: Options): TimeSeries[] {
    if (!options.dataList || options.dataList.length === 0) {
      return [];
    }

    // auto detect xaxis mode
    let firstItem;
    if (options.dataList && options.dataList.length > 0) {
      firstItem = options.dataList[0];
      const autoDetectMode = this.getAutoDetectXAxisMode(firstItem);
      if (this.panel.xaxis.mode !== autoDetectMode) {
        this.panel.xaxis.mode = autoDetectMode;
        this.setPanelDefaultsForNewXAxisMode();
      }
    }

    switch (this.panel.xaxis.mode) {
      case 'series':
      case 'time': {
        return this.getTimeSeries(options.dataList, options);
      }
      case 'histogram': {
        let histogramDataList: SeriesData[];
        if (this.panel.stack) {
          histogramDataList = options.dataList;
        } else {
          histogramDataList = [
            {
              name: 'count',
              fields: [{ name: 'Value' }, { name: 'time', type: FieldType.time }],
              rows: _.concat([], _.flatten(_.map(options.dataList, 'rows'))),
            },
          ];
        }

        return this.getTimeSeries(histogramDataList, options);
      }
      case 'field': {
        return this.customHandler(firstItem);
      }
    }

    return [];
  }

  getAutoDetectXAxisMode(firstItem) {
    switch (firstItem.type) {
      case 'docs':
        return 'field';
      case 'table':
        return 'field';
      default: {
        if (this.panel.xaxis.mode === 'series') {
          return 'series';
        }
        if (this.panel.xaxis.mode === 'histogram') {
          return 'histogram';
        }
        return 'time';
      }
    }
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

  getTimeSeries(seriesData: SeriesData[], options: Options) {
    const list: TimeSeries[] = [];
    for (const series of seriesData) {
      const { fields } = series;
      const cache = new FieldCache(fields);
      const time = cache.getFirstFieldOfType(FieldType.time);
      if (!time) {
        continue;
      }

      const seriesName = series.name ? series.name : series.refId;
      const prefix = seriesData.length > 1 ? seriesName + ' ' : '';

      for (let i = 0; i < fields.length; i++) {
        if (fields[i].type !== FieldType.number) {
          continue;
        }
        list.push(
          this.toTimeSeries(
            fields[i],
            prefix + fields[i].name, // Alias
            series.rows.map(row => {
              return [row[i], row[time.index]];
            }),
            list.length,
            options.range
          )
        );
      }
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

  customHandler(dataItem) {
    const nameField = this.panel.xaxis.name;
    if (!nameField) {
      throw {
        message: 'No field name specified to use for x-axis, check your axes settings',
      };
    }
    return [];
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

  getDataFieldNames(dataList, onlyNumbers) {
    if (dataList.length === 0) {
      return [];
    }

    const fields = [];
    const firstItem = dataList[0];
    const fieldParts = [];

    function getPropertiesRecursive(obj) {
      _.forEach(obj, (value, key) => {
        if (_.isObject(value)) {
          fieldParts.push(key);
          getPropertiesRecursive(value);
        } else {
          if (!onlyNumbers || _.isNumber(value)) {
            const field = fieldParts.concat(key).join('.');
            fields.push(field);
          }
        }
      });
      fieldParts.pop();
    }

    if (firstItem.type === 'docs') {
      if (firstItem.datapoints.length === 0) {
        return [];
      }
      getPropertiesRecursive(firstItem.datapoints[0]);
    }

    return fields;
  }

  getXAxisValueOptions(options) {
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
