import _ from 'lodash';
import { MysqlMetricFindValue } from './types';

interface TableResponse extends Record<string, any> {
  type: string;
  refId: string;
  meta: any;
}

interface SeriesResponse extends Record<string, any> {
  target: string;
  refId: string;
  meta: any;
  datapoints: [any[]];
}

export interface MysqlResponse {
  data: Array<TableResponse | SeriesResponse>;
}

export default class ResponseParser {
  processQueryResult(res: any): MysqlResponse {
    const data: any[] = [];

    if (!res.data.results) {
      return { data: data };
    }

    for (const key in res.data.results) {
      const queryRes = res.data.results[key];

      if (queryRes.series) {
        for (const series of queryRes.series) {
          data.push({
            target: series.name,
            datapoints: series.points,
            refId: queryRes.refId,
            meta: queryRes.meta,
          });
        }
      }

      if (queryRes.tables) {
        for (const table of queryRes.tables) {
          table.type = 'table';
          table.refId = queryRes.refId;
          table.meta = queryRes.meta;
          data.push(table);
        }
      }
    }

    return { data: data };
  }

  // get the list of template variables
  parseMetricFindQueryResult(refId: string, results: any): MysqlMetricFindValue[] {
    if (!results || results.data.length === 0) {
      return [];
    }

    console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<', results.data.results[refId]);

    const columns = results.data.results[refId].dataframes[0].fields;
    const frame = results.data.results[refId].dataframes[0];
    const textColIndex = this.findColIndex(columns, '__text');
    const valueColIndex = this.findColIndex(columns, '__value');

    if (columns.length === 2 && textColIndex !== -1 && valueColIndex !== -1) {
      return this.transformToKeyValueList(frame, textColIndex, valueColIndex);
    }

    return this.transformToSimpleList(frame);
  }

  transformToKeyValueList(frame: any, textColIndex: number, valueColIndex: number) {
    const res = [];

    for (let i = 0; i < frame.length; i++) {
      if (!this.containsKey(res, frame.fields[textColIndex][i])) {
        res.push({
          text: frame.fields[textColIndex][i],
          value: frame.fields[valueColIndex][i],
        });
      }
    }

    return res;
  }

  transformToSimpleList(frame: any) {
    const res = [];

    for (let i = 0; i < frame.length; i++) {
      for (let j = 0; j < frame.fields.length; j++) {
        res.push(frame.fields[j][i]);
      }
    }

    const unique = Array.from(new Set(res));

    return _.map(unique, (value) => {
      return { text: value };
    });
  }

  findColIndex(columns: any[], colName: string) {
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].name === colName) {
        return i;
      }
    }

    return -1;
  }

  containsKey(res: any[], key: any) {
    for (let i = 0; i < res.length; i++) {
      if (res[i].name === key) {
        return true;
      }
    }
    return false;
  }

  transformAnnotationResponse(options: any, data: any) {
    const table = data.data.results[options.annotation.name].tables[0];

    let timeColumnIndex = -1;
    let timeEndColumnIndex = -1;
    let textColumnIndex = -1;
    let tagsColumnIndex = -1;

    for (let i = 0; i < table.columns.length; i++) {
      if (table.columns[i].text === 'time_sec' || table.columns[i].text === 'time') {
        timeColumnIndex = i;
      } else if (table.columns[i].text === 'timeend') {
        timeEndColumnIndex = i;
      } else if (table.columns[i].text === 'title') {
        throw {
          message: 'The title column for annotations is deprecated, now only a column named text is returned',
        };
      } else if (table.columns[i].text === 'text') {
        textColumnIndex = i;
      } else if (table.columns[i].text === 'tags') {
        tagsColumnIndex = i;
      }
    }

    if (timeColumnIndex === -1) {
      throw {
        message: 'Missing mandatory time column (with time_sec column alias) in annotation query.',
      };
    }

    const list = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      const timeEnd =
        timeEndColumnIndex !== -1 && row[timeEndColumnIndex] ? Math.floor(row[timeEndColumnIndex]) : undefined;
      list.push({
        annotation: options.annotation,
        time: Math.floor(row[timeColumnIndex]),
        timeEnd,
        text: row[textColumnIndex] ? row[textColumnIndex].toString() : '',
        tags: row[tagsColumnIndex] ? row[tagsColumnIndex].trim().split(/\s*,\s*/) : [],
      });
    }

    return list;
  }
}
