import _ from 'lodash';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';
import {
  AzureLogsVariable,
  AzureLogsTableData,
  KustoDatabase,
  KustoFunction,
  KustoTable,
  KustoSchema,
  KustoColumn,
} from '../types';
import { TimeSeries, AnnotationEvent } from '@grafana/ui/src/types';

export default class ResponseParser {
  columns: string[];
  constructor(private results) {}

  parseQueryResult(): any {
    let data: any[] = [];
    let columns: any[] = [];
    for (let i = 0; i < this.results.length; i++) {
      if (this.results[i].result.data.tables.length === 0) {
        continue;
      }
      columns = this.results[i].result.data.tables[0].columns;
      const rows = this.results[i].result.data.tables[0].rows;

      if (this.results[i].query.resultFormat === 'time_series') {
        data = _.concat(data, this.parseTimeSeriesResult(this.results[i].query, columns, rows));
      } else {
        data = _.concat(data, this.parseTableResult(this.results[i].query, columns, rows));
      }
    }

    return data;
  }

  parseTimeSeriesResult(query, columns, rows): TimeSeries[] {
    const data: TimeSeries[] = [];
    let timeIndex = -1;
    let metricIndex = -1;
    let valueIndex = -1;

    for (let i = 0; i < columns.length; i++) {
      if (timeIndex === -1 && columns[i].type === 'datetime') {
        timeIndex = i;
      }

      if (metricIndex === -1 && columns[i].type === 'string') {
        metricIndex = i;
      }

      if (valueIndex === -1 && ['int', 'long', 'real', 'double'].indexOf(columns[i].type) > -1) {
        valueIndex = i;
      }
    }

    if (timeIndex === -1) {
      throw new Error('No datetime column found in the result. The Time Series format requires a time column.');
    }

    _.forEach(rows, row => {
      const epoch = ResponseParser.dateTimeToEpoch(row[timeIndex]);
      const metricName = metricIndex > -1 ? row[metricIndex] : columns[valueIndex].name;
      const bucket = ResponseParser.findOrCreateBucket(data, metricName);
      bucket.datapoints.push([row[valueIndex], epoch]);
      bucket.refId = query.refId;
      bucket.meta = {
        query: query.query,
      };
    });

    return data;
  }

  parseTableResult(query, columns, rows): AzureLogsTableData {
    const tableResult: AzureLogsTableData = {
      type: 'table',
      columns: _.map(columns, col => {
        return { text: col.name, type: col.type };
      }),
      rows: rows,
      refId: query.refId,
      meta: {
        query: query.query,
      },
    };

    return tableResult;
  }

  parseToVariables(): AzureLogsVariable[] {
    const queryResult = this.parseQueryResult();

    const variables: AzureLogsVariable[] = [];
    _.forEach(queryResult, result => {
      _.forEach(_.flattenDeep(result.rows), row => {
        variables.push({
          text: row,
          value: row,
        } as AzureLogsVariable);
      });
    });

    return variables;
  }

  transformToAnnotations(options: any) {
    const queryResult = this.parseQueryResult();

    const list: AnnotationEvent[] = [];

    _.forEach(queryResult, result => {
      let timeIndex = -1;
      let textIndex = -1;
      let tagsIndex = -1;

      for (let i = 0; i < result.columns.length; i++) {
        if (timeIndex === -1 && result.columns[i].type === 'datetime') {
          timeIndex = i;
        }

        if (textIndex === -1 && result.columns[i].text.toLowerCase() === 'text') {
          textIndex = i;
        }

        if (tagsIndex === -1 && result.columns[i].text.toLowerCase() === 'tags') {
          tagsIndex = i;
        }
      }

      _.forEach(result.rows, row => {
        list.push({
          annotation: options.annotation,
          time: Math.floor(ResponseParser.dateTimeToEpoch(row[timeIndex])),
          text: row[textIndex] ? row[textIndex].toString() : '',
          tags: row[tagsIndex] ? row[tagsIndex].trim().split(/\s*,\s*/) : [],
        });
      });
    });

    return list;
  }

  parseSchemaResult(): KustoSchema {
    return {
      Plugins: [
        {
          Name: 'pivot',
        },
      ],
      Databases: this.createSchemaDatabaseWithTables(),
    };
  }

  createSchemaDatabaseWithTables(): { [key: string]: KustoDatabase } {
    const databases = {
      Default: {
        Name: 'Default',
        Tables: this.createSchemaTables(),
        Functions: this.createSchemaFunctions(),
      },
    };

    return databases;
  }

  createSchemaTables(): { [key: string]: KustoTable } {
    const tables: { [key: string]: KustoTable } = {};

    for (const table of this.results.tables) {
      tables[table.name] = {
        Name: table.name,
        OrderedColumns: [],
      };
      for (const col of table.columns) {
        tables[table.name].OrderedColumns.push(this.convertToKustoColumn(col));
      }
    }

    return tables;
  }

  convertToKustoColumn(col: any): KustoColumn {
    return {
      Name: col.name,
      Type: col.type,
    };
  }

  createSchemaFunctions(): { [key: string]: KustoFunction } {
    const functions: { [key: string]: KustoFunction } = {};

    for (const func of this.results.functions) {
      functions[func.name] = {
        Name: func.name,
        Body: func.body,
        DocString: func.displayName,
        Folder: func.category,
        FunctionKind: 'Unknown',
        InputParameters: [],
        OutputColumns: [],
      };
    }

    return functions;
  }

  static findOrCreateBucket(data, target): TimeSeries {
    let dataTarget: any = _.find(data, ['target', target]);
    if (!dataTarget) {
      dataTarget = { target: target, datapoints: [], refId: '', query: '' };
      data.push(dataTarget);
    }

    return dataTarget;
  }

  static dateTimeToEpoch(dateTimeValue) {
    return dateTime(dateTimeValue).valueOf();
  }
}
