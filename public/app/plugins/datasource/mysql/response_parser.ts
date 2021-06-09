import { map } from 'lodash';
import { AnnotationEvent, DataFrame, FieldType, MetricFindValue } from '@grafana/data';
import { BackendDataSourceResponse, FetchResponse, toDataQueryResponse } from '@grafana/runtime';

export default class ResponseParser {
  transformMetricFindResponse(raw: FetchResponse<BackendDataSourceResponse>): MetricFindValue[] {
    const frames = toDataQueryResponse(raw).data as DataFrame[];

    if (!frames || !frames.length) {
      return [];
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
    }

    return Array.from(new Set(values.map((v) => v.text))).map((text) => ({
      text,
      value: values.find((v) => v.text === text)?.value,
    }));
  }

  transformToKeyValueList(rows: any, textColIndex: number, valueColIndex: number): MetricFindValue[] {
    const res = [];

    for (let i = 0; i < rows.length; i++) {
      if (!this.containsKey(res, rows[i][textColIndex])) {
        res.push({ text: rows[i][textColIndex], value: rows[i][valueColIndex] });
      }
    }

    return res;
  }

  transformToSimpleList(rows: any): MetricFindValue[] {
    const res = [];

    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < rows[i].length; j++) {
        res.push(rows[i][j]);
      }
    }

    const unique = Array.from(new Set(res));

    return map(unique, (value) => {
      return { text: value };
    });
  }

  findColIndex(columns: any[], colName: string) {
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].text === colName) {
        return i;
      }
    }

    return -1;
  }

  containsKey(res: any[], key: any) {
    for (let i = 0; i < res.length; i++) {
      if (res[i].text === key) {
        return true;
      }
    }
    return false;
  }

  async transformAnnotationResponse(options: any, data: BackendDataSourceResponse): Promise<AnnotationEvent[]> {
    const frames = toDataQueryResponse({ data: data }).data as DataFrame[];
    const frame = frames[0];
    const timeField = frame.fields.find((f) => f.name === 'time' || f.name === 'time_sec');

    if (!timeField) {
      throw new Error('Missing mandatory time column (with time column alias) in annotation query');
    }

    if (frame.fields.find((f) => f.name === 'title')) {
      throw new Error('The title column for annotations is deprecated, now only a column named text is returned');
    }

    const timeEndField = frame.fields.find((f) => f.name === 'timeend');
    const textField = frame.fields.find((f) => f.name === 'text');
    const tagsField = frame.fields.find((f) => f.name === 'tags');

    const list: AnnotationEvent[] = [];
    for (let i = 0; i < frame.length; i++) {
      const timeEnd = timeEndField && timeEndField.values.get(i) ? Math.floor(timeEndField.values.get(i)) : undefined;
      list.push({
        annotation: options.annotation,
        time: Math.floor(timeField.values.get(i)),
        timeEnd,
        text: textField && textField.values.get(i) ? textField.values.get(i) : '',
        tags:
          tagsField && tagsField.values.get(i)
            ? tagsField.values
                .get(i)
                .trim()
                .split(/\s*,\s*/)
            : [],
      });
    }

    return list;
  }
}
