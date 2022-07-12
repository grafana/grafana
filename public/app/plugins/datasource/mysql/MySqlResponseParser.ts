import { uniqBy } from 'lodash';

import { AnnotationEvent, AnnotationQueryRequest, DataFrame, MetricFindValue } from '@grafana/data';
import { BackendDataSourceResponse, toDataQueryResponse } from '@grafana/runtime';

export default class ResponseParser {
  transformMetricFindResponse(frame: DataFrame): MetricFindValue[] {
    const values: MetricFindValue[] = [];
    const textField = frame.fields.find((f) => f.name === '__text');
    const valueField = frame.fields.find((f) => f.name === '__value');

    if (textField && valueField) {
      for (let i = 0; i < textField.values.length; i++) {
        values.push({ text: '' + textField.values.get(i), value: '' + valueField.values.get(i) });
      }
    } else {
      values.push(
        ...frame.fields
          .flatMap((f) => f.values.toArray())
          .map((v) => ({
            text: v,
          }))
      );
    }

    return uniqBy(values, 'text');
  }

  async transformAnnotationResponse(
    options: AnnotationQueryRequest,
    data: BackendDataSourceResponse
  ): Promise<AnnotationEvent[]> {
    const frames: DataFrame[] = toDataQueryResponse({ data: data }).data;
    if (!frames || !frames.length) {
      return [];
    }
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
