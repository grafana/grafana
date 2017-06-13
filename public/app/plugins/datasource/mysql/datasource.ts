///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

export class MysqlDatasource {
  id: any;
  name: any;

  /** @ngInject **/
  constructor(instanceSettings, private backendSrv, private $q, private templateSrv) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
  }

  interpolateVariable(value) {
    if (typeof value === 'string') {
      return '\"' + value + '\"';
    }

    var quotedValues = _.map(value, function(val) {
      return '\"' + val + '\"';
    });
    return  quotedValues.join(',');
  }

  query(options) {
    var queries = _.filter(options.targets, item => {
      return item.hide !== true;
    }).map(item => {
      return {
        refId: item.refId,
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
        datasourceId: this.id,
        rawSql: this.templateSrv.replace(item.rawSql, options.scopedVars, this.interpolateVariable),
        format: item.format,
      };
    });

    if (queries.length === 0) {
      return this.$q.when({data: []});
    }

    return this.backendSrv.datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: {
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries: queries,
      }
    }).then(this.processQueryResult.bind(this));
  }

  annotationQuery(options) {
    if (!options.annotation.rawQuery) {
      return this.$q.reject({message: 'Query missing in annotation definition'});
    }

    const query = {
      refId: options.annotation.name,
      datasourceId: this.id,
      rawSql: this.templateSrv.replace(options.annotation.rawQuery, options.scopedVars, this.interpolateVariable),
      format: 'table',
    };

    return this.backendSrv.datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: {
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries: [query],
      }
    }).then(this.transformAnnotationResponse.bind(this, options));
  }

  transformAnnotationResponse(options, data) {
    const table = data.data.results[options.annotation.name].tables[0];

    let timeColumnIndex = -1;
    let titleColumnIndex = -1;
    let textColumnIndex = -1;
    let tagsColumnIndex = -1;

    for (let i = 0; i < table.columns.length; i++) {
      if (table.columns[i].text === 'time_sec') {
        timeColumnIndex = i;
      } else if (table.columns[i].text === 'title') {
        titleColumnIndex = i;
      } else if (table.columns[i].text === 'text') {
        textColumnIndex = i;
      } else if (table.columns[i].text === 'tags') {
        tagsColumnIndex = i;
      }
    }

    if (timeColumnIndex === -1) {
      return this.$q.reject({message: 'Missing mandatory time column (with time_sec column alias) in annotation query.'});
    }

    const list = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      list.push({
        annotation: options.annotation,
        time: Math.floor(row[timeColumnIndex]) * 1000,
        title: row[titleColumnIndex],
        text: row[textColumnIndex],
        tags: row[tagsColumnIndex] ? row[tagsColumnIndex].trim().split(/\s*,\s*/) : []
      });
    }

    return list;
  }

  testDatasource() {
    return this.backendSrv.datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: {
        from: '5m',
        to: 'now',
        queries: [{
          refId: 'A',
          intervalMs: 1,
          maxDataPoints: 1,
          datasourceId: this.id,
          rawSql: "SELECT 1",
          format: 'table',
        }],
      }
    }).then(res => {
      return { status: "success", message: "Database Connection OK", title: "Success" };
    }).catch(err => {
      console.log(err);
      if (err.data && err.data.message) {
        return { status: "error", message: err.data.message, title: "Error" };
      } else {
        return { status: "error", message: err.status, title: "Error" };
      }
    });
  }

  processQueryResult(res) {
    var data = [];

    if (!res.data.results) {
      return {data: data};
    }

    for (let key in res.data.results) {
      let queryRes = res.data.results[key];

      if (queryRes.series) {
        for (let series of queryRes.series) {
          data.push({
            target: series.name,
            datapoints: series.points,
            refId: queryRes.refId,
            meta: queryRes.meta,
          });
        }
      }

      if (queryRes.tables) {
        for (let table of queryRes.tables) {
          table.type = 'table';
          table.refId = queryRes.refId;
          table.meta = queryRes.meta;
          data.push(table);
        }
      }
    }

    return {data: data};
  }
}

