import { map, Observable, of } from 'rxjs';

import { AnnotationEvent, AnnotationEventMappings, AnnotationQuery, DataFrame, DataFrameView } from '@grafana/data';
import { singleFrameFromPanelData } from 'app/features/annotations/standardAnnotationSupport';

import { renderLegendFormat } from '../prometheus/legend';

export const LokiAnnotationSupport = {
  processEvents: (anno: AnnotationQuery, data: DataFrame[]) => {
    return getLokiAnnotationsFromData(data, anno.mappings);
  },
};

function getLokiAnnotationsFromData(
  data: DataFrame[],
  options?: AnnotationEventMappings
): Observable<AnnotationEvent[]> {
  return of(data).pipe(
    singleFrameFromPanelData(),
    map((frame) => {
      if (!frame?.length) {
        return [];
      }

      const list: any[] = [];
      const view = new DataFrameView(frame).toArray();

      for (var i = 0; i < view.length; i++) {
        const event: any = {};

        if (options?.time?.value) {
          const time = view[i][options.time.value] ? view[i][options.time.value] : options.time.value;
          if (typeof time === 'string') {
            event.time = new Date(time ?? '').valueOf();
          }
        }

        if (options?.timeEnd?.value) {
          const timeEnd = view[i][options.timeEnd.value] ? view[i][options.timeEnd.value] : options.timeEnd.value;
          if (typeof timeEnd === 'string') {
            event.timeEnd = new Date(timeEnd ?? '').valueOf();
          }
        }

        if (options?.title?.value) {
          const title = view[i][options.title.value] ? view[i][options.title.value] : options.title.value;
          if (typeof title === 'string') {
            event.title = renderLegendFormat(title, view[i].labels ?? '');
          }
        }

        if (options?.text?.value) {
          const text = view[i][options.text.value] ? view[i][options.text.value] : options.text.value;
          if (typeof text === 'string') {
            event.text = renderLegendFormat(text, view[i].labels ?? '');
          }
        }

        if (options?.tags?.value) {
          if (options.tags.value === 'labels') {
            if (view[i].labels) {
              const tags = Object.entries(view[i].labels)
                .filter(([key, val]) => {
                  // remove empty
                  if (val === '') {
                    return false;
                  }
                  return true;
                })
                .map(([key, val]) => String(val).trim()); // keep only the label-value

              // remove duplicates
              event.tags = Array.from(new Set(tags));
            }
          } else {
            const tags = view[i][options.tags.value] ? view[i][options.tags.value] : options.tags.value;
            if (tags.includes(',')) {
              event.tags = tags.split(',');
            } else {
              event.tags = new Array(tags);
            }
          }
        }

        list.push(event);
      }

      return list;
    })
  );
}
