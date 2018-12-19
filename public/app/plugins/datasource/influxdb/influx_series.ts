import _ from 'lodash';
import TableModel from 'app/core/table_model';

export default class InfluxSeries {
  series: any;
  alias: any;
  annotation: any;

  constructor(options) {
    this.series = options.series;
    this.alias = options.alias;
    this.annotation = options.annotation;
  }

  getTimeSeries() {
    const output = [];
    let i, j;

    if (this.series.length === 0) {
      return output;
    }

    _.each(this.series, series => {
      const columns = series.columns.length;
      const tags = _.map(series.tags, (value, key) => {
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

        output.push({ target: seriesName, datapoints: datapoints });
      }
    });

    return output;
  }

  _getSeriesName(series, index) {
    const regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
    const segments = series.name.split('.');

    return this.alias.replace(regex, (match, g1, g2) => {
      const group = g1 || g2;
      const segIndex = parseInt(group, 10);

      if (group === 'm' || group === 'measurement') {
        return series.name;
      }
      if (group === 'col') {
        return series.columns[index];
      }
      if (!isNaN(segIndex)) {
        return segments[segIndex];
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
    const list = [];

    _.each(this.series, series => {
      let titleCol = null;
      let timeCol = null;
      const tagsCol = [];
      let textCol = null;

      _.each(series.columns, (column, index) => {
        if (column === 'time') {
          timeCol = index;
          return;
        }
        if (column === 'sequence_number') {
          return;
        }
        if (column === this.annotation.titleColumn) {
          titleCol = index;
          return;
        }
        if (_.includes((this.annotation.tagsColumn || '').replace(' ', '').split(','), column)) {
          tagsCol.push(index);
          return;
        }
        if (column === this.annotation.textColumn) {
          textCol = index;
          return;
        }
        // legacy case
        if (!titleCol && textCol !== index) {
          titleCol = index;
        }
      });

      _.each(series.values, value => {
        const data = {
          annotation: this.annotation,
          time: +new Date(value[timeCol]),
          title: value[titleCol],
          // Remove empty values, then split in different tags for comma separated values
          tags: _.flatten(
            tagsCol
              .filter(t => {
                return value[t];
              })
              .map(t => {
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

  getTable() {
    const table = new TableModel();
    let i, j;

    if (this.series.length === 0) {
      return table;
    }

    _.each(this.series, (series, seriesIndex) => {
      if (seriesIndex === 0) {
        j = 0;
        // Check that the first column is indeed 'time'
        if (series.columns[0] === 'time') {
          // Push this now before the tags and with the right type
          table.columns.push({ text: 'Time', type: 'time' });
          j++;
        }
        _.each(_.keys(series.tags), key => {
          table.columns.push({ text: key });
        });
        for (; j < series.columns.length; j++) {
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
