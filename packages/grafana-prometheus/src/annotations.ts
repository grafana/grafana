import { Observable, of } from 'rxjs';

import {
  AnnotationEvent,
  AnnotationQuery,
  AnnotationSupport,
  DataFrame,
  rangeUtil,
  renderLegendFormat,
} from '@grafana/data';

import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import { PrometheusDatasource } from './datasource';
import { PromQuery } from './types';

const ANNOTATION_QUERY_STEP_DEFAULT = '60s';

export const PrometheusAnnotationSupport = (ds: PrometheusDatasource): AnnotationSupport<PromQuery> => {
  return {
    QueryEditor: AnnotationQueryEditor,
    prepareAnnotation(json: AnnotationQuery<PromQuery>): AnnotationQuery<PromQuery> {
      // Initialize target if it doesn't exist
      if (!json.target) {
        json.target = {
          expr: '',
          refId: 'Anno',
        };
      }

      // Create a new target, preserving existing values when present
      json.target = {
        ...json.target,
        refId: json.target.refId || json.refId || 'Anno',
        expr: json.target.expr || json.expr || '',
        interval: json.target.interval || json.step || '',
      };

      // Remove properties that have been transferred to target
      delete json.expr;
      delete json.step;

      return json;
    },
    processEvents(anno: AnnotationQuery<PromQuery>, frames: DataFrame[]): Observable<AnnotationEvent[] | undefined> {
      if (!frames.length) {
        return new Observable<undefined>();
      }

      const { tagKeys = '', titleFormat = '', textFormat = '' } = anno;

      const input = frames[0].meta?.executedQueryString || '';
      const regex = /Step:\s*([\d\w]+)/;
      const match = input.match(regex);
      const stepValue = match ? match[1] : null;
      const step = rangeUtil.intervalToSeconds(stepValue || ANNOTATION_QUERY_STEP_DEFAULT) * 1000;
      const tagKeysArray = tagKeys.split(',');

      const eventList: AnnotationEvent[] = [];

      for (const frame of frames) {
        if (frame.fields.length === 0) {
          continue;
        }
        const timeField = frame.fields[0];
        const valueField = frame.fields[1];
        const labels = valueField?.labels || {};

        const tags = Object.keys(labels)
          .filter((label) => tagKeysArray.includes(label))
          .map((label) => labels[label]);

        const timeValueTuple: Array<[number, number]> = [];

        let idx = 0;
        valueField.values.forEach((value: string) => {
          let timeStampValue: number;
          let valueValue: number;
          const time = timeField.values[idx];

          // If we want to use value as a time, we use value as timeStampValue and valueValue will be 1
          if (anno.useValueForTime) {
            timeStampValue = Math.floor(parseFloat(value));
            valueValue = 1;
          } else {
            timeStampValue = Math.floor(parseFloat(time));
            valueValue = parseFloat(value);
          }

          idx++;
          timeValueTuple.push([timeStampValue, valueValue]);
        });

        const activeValues = timeValueTuple.filter((value) => value[1] > 0);
        const activeValuesTimestamps = activeValues.map((value) => value[0]);

        // Instead of creating singular annotation for each active event we group events into region if they are less
        // or equal to `step` apart.
        let latestEvent: AnnotationEvent | null = null;

        for (const timestamp of activeValuesTimestamps) {
          // We already have event `open` and we have new event that is inside the `step` so we just update the end.
          if (latestEvent && (latestEvent.timeEnd ?? 0) + step >= timestamp) {
            latestEvent.timeEnd = timestamp;
            continue;
          }

          // Event exists but new one is outside of the `step` so we add it to eventList.
          if (latestEvent) {
            eventList.push(latestEvent);
          }

          // We start a new region.
          latestEvent = {
            time: timestamp,
            timeEnd: timestamp,
            annotation: anno,
            title: renderLegendFormat(titleFormat, labels),
            tags,
            text: renderLegendFormat(textFormat, labels),
          };
        }

        // Finish up last point if we have one
        if (latestEvent) {
          latestEvent.timeEnd = activeValuesTimestamps[activeValuesTimestamps.length - 1];
          eventList.push(latestEvent);
        }
      }

      return of(eventList);
    },
  };
};
