import { AnnotationEvent, DataFrame, FieldType, MetricFindValue } from '@grafana/data';
import { BackendDataSourceResponse, toDataQueryResponse, FetchResponse } from '@grafana/runtime';

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

      return values;
    }

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
    return values;
  }

  async transformAnnotationResponse(options: any, data: BackendDataSourceResponse): Promise<AnnotationEvent[]> {
    const frames = toDataQueryResponse({ data: data }).data as DataFrame[];
    const frame = frames[0];
    let timeColumnIndex = -1;
    let timeEndColumnIndex = -1;
    let textColumnIndex = -1;
    let tagsColumnIndex = -1;

    for (let i = 0; i < frame.fields.length; i++) {
      const fieldName = frame.fields[i].name;
      if (fieldName === 'time') {
        timeColumnIndex = i;
      } else if (fieldName === 'timeend') {
        timeEndColumnIndex = i;
      } else if (fieldName === 'text') {
        textColumnIndex = i;
      } else if (fieldName === 'tags') {
        tagsColumnIndex = i;
      }
    }

    if (timeColumnIndex === -1) {
      return Promise.reject({ message: 'Missing mandatory time column (with time column alias) in annotation query.' });
    }

    const list: AnnotationEvent[] = [];
    for (let i = 0; i < frame.fields.length; i++) {
      const field = frame.fields[i];
      const row = field.values.get(0);
      const timeEnd =
        timeEndColumnIndex !== -1 && row[timeEndColumnIndex] ? Math.floor(row[timeEndColumnIndex]) : undefined;
      list.push({
        annotation: options.annotation,
        time: Math.floor(row[timeColumnIndex]),
        timeEnd,
        text: row[textColumnIndex],
        tags: row[tagsColumnIndex] ? row[tagsColumnIndex].trim().split(/\s*,\s*/) : [],
      });
    }

    return list;
  }
}
