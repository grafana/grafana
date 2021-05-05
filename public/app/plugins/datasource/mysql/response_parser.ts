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

export interface MySqlResponse {
  data: Array<TableResponse | SeriesResponse>;
}

export default class ResponseParser {
  processQueryResult(res: any): MySqlResponse {
    const data: any[] = [];

    if (!res.data.results) {
      return { data: data };
    }

    const frame = frames[0];

    const values: MetricFindValue[] = [];
    const textField = frame.fields.find((f) => f.name === '__text');
    const valueField = frame.fields.find((f) => f.name === '__value');

    if (textField && valueField) {
      for (let i = 0; i < textField.values.length; i++) {
        values.push({ text: '' + textField.values.get(i), value: '' + valueField.values.get(i) });
      }
    } else {
      const textFields = frame.fields.filter((f) => f.type === FieldType.string);
      if (textFields) {
        values.push(
          ...textFields
            .flatMap((f) => f.values.toArray())
            .map((v) => ({
              text: '' + v,
            }))
        );
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
