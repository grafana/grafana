import { concat, find, flattenDeep, forEach, get, map } from 'lodash';
import { AnnotationEvent, dateTime, TimeSeries } from '@grafana/data';
import { AzureLogsTableData, AzureLogsVariable } from '../types';
import { AzureLogAnalyticsMetadata } from '../types/logAnalyticsMetadata';

export default class ResponseParser {
  columns: string[];
  constructor(private results: any) {}

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
        data = concat(data, this.parseTimeSeriesResult(this.results[i].query, columns, rows));
      } else {
        data = concat(data, this.parseTableResult(this.results[i].query, columns, rows));
      }
    }

    return data;
  }

  parseTimeSeriesResult(query: { refId: string; query: any }, columns: any[], rows: any): TimeSeries[] {
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

    forEach(rows, (row) => {
      const epoch = ResponseParser.dateTimeToEpoch(row[timeIndex]);
      const metricName = metricIndex > -1 ? row[metricIndex] : columns[valueIndex].name;
      const bucket = ResponseParser.findOrCreateBucket(data, metricName);
      bucket.datapoints.push([row[valueIndex], epoch]);
      bucket.refId = query.refId;
      bucket.meta = {
        executedQueryString: query.query,
      };
    });

    return data;
  }

  parseTableResult(query: { refId: string; query: string }, columns: any[], rows: any[]): AzureLogsTableData {
    const tableResult: AzureLogsTableData = {
      type: 'table',
      columns: map(columns, (col) => {
        return { text: col.name, type: col.type };
      }),
      rows: rows,
      refId: query.refId,
      meta: {
        executedQueryString: query.query,
      },
    };

    return tableResult;
  }

  parseToVariables(): AzureLogsVariable[] {
    const queryResult = this.parseQueryResult();

    const variables: AzureLogsVariable[] = [];
    forEach(queryResult, (result) => {
      forEach(flattenDeep(result.rows), (row) => {
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

    forEach(queryResult, (result) => {
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

      forEach(result.rows, (row) => {
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

  static findOrCreateBucket(data: TimeSeries[], target: any): TimeSeries {
    let dataTarget: any = find(data, ['target', target]);
    if (!dataTarget) {
      dataTarget = { target: target, datapoints: [], refId: '', query: '' };
      data.push(dataTarget);
    }

    return dataTarget;
  }

  static dateTimeToEpoch(dateTimeValue: any) {
    return dateTime(dateTimeValue).valueOf();
  }

  static parseSubscriptions(result: any): Array<{ text: string; value: string }> {
    const list: Array<{ text: string; value: string }> = [];

    if (!result) {
      return list;
    }

    const valueFieldName = 'subscriptionId';
    const textFieldName = 'displayName';
    for (let i = 0; i < result.data.value.length; i++) {
      if (!find(list, ['value', get(result.data.value[i], valueFieldName)])) {
        list.push({
          text: `${get(result.data.value[i], textFieldName)}`,
          value: get(result.data.value[i], valueFieldName),
        });
      }
    }

    return list;
  }
}

// matches (name):(type) = (defaultValue)
// e.g. fromRangeStart:datetime = datetime(null)
//  - name: fromRangeStart
//  - type: datetime
//  - defaultValue: datetime(null)
const METADATA_FUNCTION_PARAMS = /([\w\W]+):([\w]+)(?:\s?=\s?([\w\W]+))?/;

function transformMetadataFunction(sourceSchema: AzureLogAnalyticsMetadata) {
  if (!sourceSchema.functions) {
    return [];
  }

  return sourceSchema.functions.map((fn) => {
    const params =
      fn.parameters &&
      fn.parameters
        .split(', ')
        .map((arg) => {
          const match = arg.match(METADATA_FUNCTION_PARAMS);
          if (!match) {
            return;
          }

          const [, name, type, defaultValue] = match;

          return {
            name,
            type,
            defaultValue,
            cslDefaultValue: defaultValue,
          };
        })
        .filter(<T>(v: T): v is Exclude<T, undefined> => !!v);

    return {
      name: fn.name,
      body: fn.body,
      inputParameters: params || [],
    };
  });
}

export function transformMetadataToKustoSchema(sourceSchema: AzureLogAnalyticsMetadata, nameOrIdOrSomething: string) {
  const database = {
    name: nameOrIdOrSomething,
    tables: sourceSchema.tables,
    functions: transformMetadataFunction(sourceSchema),
    majorVersion: 0,
    minorVersion: 0,
  };

  return {
    clusterType: 'Engine',
    cluster: {
      connectionString: nameOrIdOrSomething,
      databases: [database],
    },
    database: database,
  };
}
