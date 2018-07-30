import _ from 'lodash';

export default class ResponseTransformer {
  transformTimeSeriesQueryResult(res) {
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
          if (table.rows.length > 1) {
            table.type = 'table';
            table.refId = queryRes.refId;
            table.meta = queryRes.meta;
            data.push(table);
          } else {
            data.push({
              target: 'docs',
              type: 'docs',
              datapoints: table.rows[0][0],
              total: table.rows[0][1],
              filterable: true,
            });
          }
        }
      }
    }

    return { data: data };
  }

  transformAnnotationQueryResponse(annotation, res) {
    if (!res.data.results || !res.data.results[annotation.name] || !res.data.results[annotation.name].tables) {
      return [];
    }

    const table = res.data.results[annotation.name].tables[0];
    const events = [];

    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      events.push({
        annotation: annotation,
        time: Math.floor(row[0]),
        text: row[1],
        tags: row[2],
      });
    }

    return events;
  }

  transformFieldsQueryResponse(refId, res) {
    if (!res.data.results || !res.data.results[refId] || !res.data.results[refId].tables) {
      return [];
    }

    return _.map(res.data.results[refId].tables[0].rows, row => ({
      text: row[0],
      type: row[1],
    }));
  }

  transformTermsQueryResponse(refId, res) {
    if (!res.data.results || !res.data.results[refId] || !res.data.results[refId].tables) {
      return [];
    }

    return _.map(res.data.results[refId].tables[0].rows, row => ({
      text: row[0],
      value: row[1],
    }));
  }
}
