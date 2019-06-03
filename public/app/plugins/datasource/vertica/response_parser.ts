import _ from 'lodash';

export default class ResponseParser {
  constructor(private $q) {}

  processQueryResult(res) {
    const data = [];

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

  parseMetricFindQueryResult(refId, results) {
    if (!results || results.data.length === 0 || results.data.results[refId].meta.rowCount === 0) {
      return [];
    }

    const columns = results.data.results[refId].tables[0].columns;
    const rows = results.data.results[refId].tables[0].rows;
    const textColIndex = this.findColIndex(columns, '__text');
    const valueColIndex = this.findColIndex(columns, '__value');

    if (columns.length === 2 && textColIndex !== -1 && valueColIndex !== -1) {
      return this.transformToKeyValueList(rows, textColIndex, valueColIndex);
    }

    return this.transformToSimpleList(rows);
  }

  transformToKeyValueList(rows, textColIndex, valueColIndex) {
    const res = [];

    for (let i = 0; i < rows.length; i++) {
      if (!this.containsKey(res, rows[i][textColIndex])) {
        res.push({
          text: rows[i][textColIndex],
          value: rows[i][valueColIndex],
        });
      }
    }

    return res;
  }

  transformToSimpleList(rows) {
    const res = [];

    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < rows[i].length; j++) {
        const value = rows[i][j];
        if (res.indexOf(value) === -1) {
          res.push(value);
        }
      }
    }

    return _.map(res, value => {
      return { text: value };
    });
  }

  findColIndex(columns, colName) {
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].text === colName) {
        return i;
      }
    }

    return -1;
  }

  containsKey(res, key) {
    for (let i = 0; i < res.length; i++) {
      if (res[i].text === key) {
        return true;
      }
    }
    return false;
  }

  transformAnnotationResponse(options, data) {
    const table = data.data.results[options.annotation.name].tables[0];

    let timeColumnIndex = -1;
    const titleColumnIndex = -1;
    let textColumnIndex = -1;
    let tagsColumnIndex = -1;

    for (let i = 0; i < table.columns.length; i++) {
      if (table.columns[i].text === 'time') {
        timeColumnIndex = i;
      } else if (table.columns[i].text === 'text') {
        textColumnIndex = i;
      } else if (table.columns[i].text === 'tags') {
        tagsColumnIndex = i;
      }
    }

    if (timeColumnIndex === -1) {
      return this.$q.reject({
        message: 'Missing mandatory time column in annotation query.',
      });
    }

    const list = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      list.push({
        annotation: options.annotation,
        time: Math.floor(row[timeColumnIndex]),
        title: row[titleColumnIndex],
        text: row[textColumnIndex],
        tags: row[tagsColumnIndex] ? row[tagsColumnIndex].trim().split(/\s*,\s*/) : [],
      });
    }

    return list;
  }
}
