import { map, Observable, of } from 'rxjs';

import { AnnotationEvent, AnnotationEventMappings, AnnotationQuery, DataFrame, toUtc } from '@grafana/data';
import { singleFrameFromPanelData } from 'app/features/annotations/standardAnnotationSupport';

export const ElasticSearchAnnotationSupport = {
  processEvents: (anno: AnnotationQuery, data: DataFrame[]) => {
    return getElasticSearchAnnotationsFromData(data, anno.mappings);
  },
};

function getElasticSearchAnnotationsFromData(
  data: DataFrame[],
  options?: AnnotationEventMappings
): Observable<AnnotationEvent[]> {
  return of(data).pipe(
    singleFrameFromPanelData(),
    map((frame) => {
      if (!frame?.length) {
        return [];
      }

      const list = [];
      const source = frame.fields
        .filter((field) => {
          return field.name === '_source';
        })[0]
        ?.values.toArray();

      if (source) {
        for (let j = 0; j < source.length; j++) {
          const event: any = {
            time: toUtc(source[j][options?.time?.value ?? '']).valueOf(),
            text: source[j][options?.text?.value ?? ''],
            tags: source[j][options?.tags?.value ?? ''],
          };

          if (options?.timeEnd) {
            const timeEnd = source[j][options.timeEnd.value ?? ''];
            if (timeEnd) {
              event.timeEnd = toUtc(timeEnd).valueOf();
            }
          }

          // legacy support for title field
          if (options?.title) {
            const title = source[j][options.title.value ?? ''];
            if (title) {
              event.text = title + '\n' + event.text;
            }
          }

          if (typeof event.tags === 'string') {
            event.tags = event.tags.split(',');
          }

          list.push(event);
        }
      }

      return list;
    })
  );
}
