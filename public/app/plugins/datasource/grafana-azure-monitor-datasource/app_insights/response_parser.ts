import _ from 'lodash';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';

export default class ResponseParser {
  constructor(private results) {}

  parseQueryResult() {
    let data: any = [];
    let columns: any = [];
    for (let i = 0; i < this.results.length; i++) {
      if (this.results[i].query.raw) {
        const xaxis = this.results[i].query.xaxis;
        const yaxises = this.results[i].query.yaxis;
        const spliton = this.results[i].query.spliton;
        columns = this.results[i].result.data.Tables[0].Columns;
        const rows = this.results[i].result.data.Tables[0].Rows;
        data = _.concat(
          data,
          this.parseRawQueryResultRow(this.results[i].query, columns, rows, xaxis, yaxises, spliton)
        );
      } else {
        const value = this.results[i].result.data.value;
        const alias = this.results[i].query.alias;
        data = _.concat(data, this.parseQueryResultRow(this.results[i].query, value, alias));
      }
    }
    return data;
  }

  parseRawQueryResultRow(query: any, columns, rows, xaxis: string, yaxises: string, spliton: string) {
    const data: any[] = [];
    const columnsForDropdown = _.map(columns, column => ({ text: column.ColumnName, value: column.ColumnName }));

    const xaxisColumn = columns.findIndex(column => column.ColumnName === xaxis);
    const yaxisesSplit = yaxises.split(',');
    const yaxisColumns = {};
    _.forEach(yaxisesSplit, yaxis => {
      yaxisColumns[yaxis] = columns.findIndex(column => column.ColumnName === yaxis);
    });
    const splitonColumn = columns.findIndex(column => column.ColumnName === spliton);
    const convertTimestamp = xaxis === 'timestamp';

    _.forEach(rows, row => {
      _.forEach(yaxisColumns, (yaxisColumn, yaxisName) => {
        const bucket =
          splitonColumn === -1
            ? ResponseParser.findOrCreateBucket(data, yaxisName)
            : ResponseParser.findOrCreateBucket(data, row[splitonColumn]);
        const epoch = convertTimestamp ? ResponseParser.dateTimeToEpoch(row[xaxisColumn]) : row[xaxisColumn];
        bucket.datapoints.push([row[yaxisColumn], epoch]);
        bucket.refId = query.refId;
        bucket.query = query.query;
        bucket.columnsForDropdown = columnsForDropdown;
      });
    });

    return data;
  }

  parseQueryResultRow(query: any, value, alias: string) {
    const data: any[] = [];

    if (ResponseParser.isSingleValue(value)) {
      const metricName = ResponseParser.getMetricFieldKey(value);
      const aggField = ResponseParser.getKeyForAggregationField(value[metricName]);
      const epoch = ResponseParser.dateTimeToEpoch(value.end);
      data.push({
        target: metricName,
        datapoints: [[value[metricName][aggField], epoch]],
        refId: query.refId,
        query: query.query,
      });
      return data;
    }

    const groupedBy = ResponseParser.hasSegmentsField(value.segments[0]);
    if (!groupedBy) {
      const metricName = ResponseParser.getMetricFieldKey(value.segments[0]);
      const dataTarget = ResponseParser.findOrCreateBucket(data, metricName);

      for (let i = 0; i < value.segments.length; i++) {
        const epoch = ResponseParser.dateTimeToEpoch(value.segments[i].end);
        const aggField: string = ResponseParser.getKeyForAggregationField(value.segments[i][metricName]);

        dataTarget.datapoints.push([value.segments[i][metricName][aggField], epoch]);
      }
      dataTarget.refId = query.refId;
      dataTarget.query = query.query;
    } else {
      for (let i = 0; i < value.segments.length; i++) {
        const epoch = ResponseParser.dateTimeToEpoch(value.segments[i].end);

        for (let j = 0; j < value.segments[i].segments.length; j++) {
          const metricName = ResponseParser.getMetricFieldKey(value.segments[i].segments[j]);
          const aggField = ResponseParser.getKeyForAggregationField(value.segments[i].segments[j][metricName]);
          const target = this.getTargetName(value.segments[i].segments[j], alias);

          const bucket = ResponseParser.findOrCreateBucket(data, target);
          bucket.datapoints.push([value.segments[i].segments[j][metricName][aggField], epoch]);
          bucket.refId = query.refId;
          bucket.meta = {
            query: query.query,
          };
        }
      }
    }

    return data;
  }

  getTargetName(segment, alias: string) {
    let metric = '';
    let segmentName = '';
    let segmentValue = '';
    for (const prop in segment) {
      if (_.isObject(segment[prop])) {
        metric = prop;
      } else {
        segmentName = prop;
        segmentValue = segment[prop];
      }
    }

    if (alias) {
      const regex = /\{\{([\s\S]+?)\}\}/g;
      return alias.replace(regex, (match, g1, g2) => {
        const group = g1 || g2;

        if (group === 'metric') {
          return metric;
        } else if (group === 'groupbyname') {
          return segmentName;
        } else if (group === 'groupbyvalue') {
          return segmentValue;
        }

        return match;
      });
    }

    return metric + `{${segmentName}="${segmentValue}"}`;
  }

  static isSingleValue(value) {
    return !ResponseParser.hasSegmentsField(value);
  }

  static findOrCreateBucket(data, target) {
    let dataTarget: any = _.find(data, ['target', target]);
    if (!dataTarget) {
      dataTarget = { target: target, datapoints: [] };
      data.push(dataTarget);
    }

    return dataTarget;
  }

  static hasSegmentsField(obj) {
    const keys = _.keys(obj);
    return _.indexOf(keys, 'segments') > -1;
  }

  static getMetricFieldKey(segment) {
    const keys = _.keys(segment);

    return _.filter(_.without(keys, 'start', 'end'), key => {
      return _.isObject(segment[key]);
    })[0];
  }

  static getKeyForAggregationField(dataObj): string {
    const keys = _.keys(dataObj);
    return _.intersection(keys, ['sum', 'avg', 'min', 'max', 'count', 'unique'])[0];
  }

  static dateTimeToEpoch(dateTimeValue) {
    return dateTime(dateTimeValue).valueOf();
  }

  static parseMetricNames(result) {
    const keys = _.keys(result.data.metrics);

    return ResponseParser.toTextValueList(keys);
  }

  parseMetadata(metricName: string) {
    const metric = this.results.data.metrics[metricName];

    if (!metric) {
      throw Error('No data found for metric: ' + metricName);
    }

    return {
      primaryAggType: metric.defaultAggregation,
      supportedAggTypes: metric.supportedAggregations,
      supportedGroupBy: metric.supportedGroupBy.all,
    };
  }

  parseGroupBys() {
    return ResponseParser.toTextValueList(this.results.supportedGroupBy);
  }

  parseQuerySchema() {
    const result = {
      Type: 'AppInsights',
      Tables: {},
    };
    if (this.results && this.results.data && this.results.data.Tables) {
      for (let i = 0; i < this.results.data.Tables[0].Rows.length; i++) {
        const column = this.results.data.Tables[0].Rows[i];
        const columnTable = column[0];
        const columnName = column[1];
        const columnType = column[2];
        if (result.Tables[columnTable]) {
          result.Tables[columnTable].OrderedColumns.push({ Name: columnName, Type: columnType });
        } else {
          result.Tables[columnTable] = {
            Name: columnTable,
            OrderedColumns: [{ Name: columnName, Type: columnType }],
          };
        }
      }
    }
    return result;
  }

  static toTextValueList(values) {
    const list: any[] = [];
    for (let i = 0; i < values.length; i++) {
      list.push({
        text: values[i],
        value: values[i],
      });
    }
    return list;
  }
}
