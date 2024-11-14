import { each, map, includes, flatten, keys } from 'lodash';

import { FieldType, QueryResultMeta, TimeSeries, TableData } from '@grafana/data';
import TableModel from 'app/core/TableModel';

import { InfluxQuery } from './types';

export default class InfluxSeries {
  refId?: string;
  series: any;
  alias?: string;
  annotation?: InfluxQuery;
  meta?: QueryResultMeta;

  constructor(options: {
    series: any;
    alias?: string;
    annotation?: InfluxQuery;
    meta?: QueryResultMeta;
    refId?: string;
  }) {
    this.series = options.series;
    this.alias = options.alias;
    this.annotation = options.annotation;
    this.meta = options.meta;
    this.refId = options.refId;
  }

  getTimeSeries(): TimeSeries[] {
    const output: TimeSeries[] = [];
    let i, j;

    if (this.series.length === 0) {
      return output;
    }

    each(this.series, (series) => {
      const columns = series.columns.length;
      const tags = map(series.tags, (value, key) => {
        return key + ': ' + value;
      });

      for (j = 1; j < columns; j++) {
        let seriesName = series.name;
        const columnName = series.columns[j];
        if (columnName !== 'value') {
          seriesName = seriesName + '.' + columnName;
        }

        if (this.alias) {
          seriesName = this._getSeriesName(series, j);
        } else if (series.tags) {
          seriesName = seriesName + ' {' + tags.join(', ') + '}';
        }

        const datapoints = [];
        if (series.values) {
          for (i = 0; i < series.values.length; i++) {
            datapoints[i] = [series.values[i][j], series.values[i][0]];
          }
        }

        output.push({
          title: seriesName,
          target: seriesName,
          datapoints: datapoints,
          tags: series.tags,
          meta: this.meta,
          refId: this.refId,
        });
      }
    });

    return output;
  }

  _getSeriesName(series: any, index: number) {
    const regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
    const segments = series.name.split('.');

    return this.alias?.replace(regex, (match, g1, g2) => {
      const group = g1 || g2;
      const segIndex = parseInt(group, 10);

      if (group === 'm' || group === 'measurement') {
        return series.name;
      }
      if (group === 'col') {
        return series.columns[index];
      }
      if (!isNaN(segIndex)) {
        return segments[segIndex] ?? match;
      }
      if (group.indexOf('tag_') !== 0) {
        return match;
      }

      const tag = group.replace('tag_', '');
      if (!series.tags) {
        return match;
      }
      return series.tags[tag];
    });
  }

  getAnnotations() {
    const list: any[] = [];

    each(this.series, (series) => {
      let titleCol: any = null;
      let timeCol: any = null;
      let timeEndCol: any = null;
      const tagsCol: string[] = [];
      let textCol: any = null;

      each(series.columns, (column, index) => {
        if (column === 'time') {
          timeCol = index;
          return;
        }
        if (column === 'sequence_number') {
          return;
        }
        if (column === this.annotation?.titleColumn) {
          titleCol = index;
          return;
        }
        if (includes((this.annotation?.tagsColumn || '').replace(' ', '').split(','), column)) {
          tagsCol.push(index);
          return;
        }
        if (column === this.annotation?.textColumn) {
          textCol = index;
          return;
        }
        if (column === this.annotation?.timeEndColumn) {
          timeEndCol = index;
          return;
        }
        // legacy case
        if (!titleCol && textCol !== index) {
          titleCol = index;
        }
      });

      each(series.values, (value) => {
        const data = {
          annotation: this.annotation,
          time: +new Date(value[timeCol]),
          title: value[titleCol],
          timeEnd: value[timeEndCol],
          // Remove empty values, then split in different tags for comma separated values
          tags: flatten(
            tagsCol
              .filter((t) => {
                return value[t];
              })
              .map((t) => {
                return value[t].split(',');
              })
          ),
          text: value[textCol],
        };

        list.push(data);
      });
    });

    return list;
  }

  getTable(): TableData {
    const table = new TableModel();
    let i, j;

    table.refId = this.refId;
    table.meta = this.meta;

    if (this.series.length === 0) {
      return table;
    }

    // the order is:
    // - first the first item from the value-array (this is often (always?) the timestamp)
    // - then all the tag-values
    // - then the rest of the value-array
    //
    // we have to keep this order both in table.columns and table.rows

    each(this.series, (series: any, seriesIndex: number) => {
      if (seriesIndex === 0) {
        const firstCol = series.columns[0];
        // Check the first column's name, if it is `time`, we
        // mark it as having the type time
        const firstTableCol = firstCol === 'time' ? { text: 'Time', type: FieldType.time } : { text: firstCol };
        table.columns.push(firstTableCol);
        each(keys(series.tags), (key) => {
          table.columns.push({ text: key });
        });
        for (j = 1; j < series.columns.length; j++) {
          table.columns.push({ text: series.columns[j] });
        }
      }

      if (series.values) {
        for (i = 0; i < series.values.length; i++) {
          const values = series.values[i];
          const reordered = [values[0]];
          if (series.tags) {
            for (const key in series.tags) {
              if (series.tags.hasOwnProperty(key)) {
                reordered.push(series.tags[key]);
              }
            }
          }
          for (j = 1; j < values.length; j++) {
            reordered.push(values[j]);
          }
          table.rows.push(reordered);
        }
      }
    });

    return table;
  }
}
