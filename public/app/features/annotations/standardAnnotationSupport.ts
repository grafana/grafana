import { Observable, of, OperatorFunction } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import {
  AnnotationEvent,
  AnnotationEventFieldSource,
  AnnotationEventMappings,
  AnnotationQuery,
  AnnotationSupport,
  DataFrame,
  Field,
  FieldType,
  getFieldDisplayName,
  KeyValue,
  standardTransformers,
} from '@grafana/data';

import isString from 'lodash/isString';

export const standardAnnotationSupport: AnnotationSupport = {
  /**
   * Assume the stored value is standard model.
   */
  prepareAnnotation: (json: any) => {
    if (isString(json?.query)) {
      const { query, ...rest } = json;
      return {
        ...rest,
        target: {
          query,
        },
        mappings: {},
      };
    }
    return json as AnnotationQuery;
  },

  /**
   * Convert the stored JSON model and environment to a standard datasource query object.
   * This query will be executed in the datasource and the results converted into events.
   * Returning an undefined result will quietly skip query execution
   */
  prepareQuery: (anno: AnnotationQuery) => anno.target,

  /**
   * When the standard frame > event processing is insufficient, this allows explicit control of the mappings
   */
  processEvents: (anno: AnnotationQuery, data: DataFrame[]) => {
    return getAnnotationsFromData(data, anno.mappings);
  },
};

/**
 * Flatten all panel data into a single frame
 */

export function singleFrameFromPanelData(): OperatorFunction<DataFrame[], DataFrame | undefined> {
  return source =>
    source.pipe(
      mergeMap(data => {
        if (!data?.length) {
          return of(undefined);
        }

        if (data.length === 1) {
          return of(data[0]);
        }

        return of(data).pipe(
          standardTransformers.mergeTransformer.operator({}),
          map(d => d[0])
        );
      })
    );
}

interface AnnotationEventFieldSetter {
  key: keyof AnnotationEvent;
  field?: Field;
  text?: string;
  regex?: RegExp;
  split?: string; // for tags
}

export interface AnnotationFieldInfo {
  key: keyof AnnotationEvent;

  split?: string;
  field?: (frame: DataFrame) => Field | undefined;
  placeholder?: string;
  help?: string;
}

export const annotationEventNames: AnnotationFieldInfo[] = [
  {
    key: 'time',
    field: (frame: DataFrame) => frame.fields.find(f => f.type === FieldType.time),
    placeholder: 'time, or the first time field',
  },
  { key: 'timeEnd', help: 'When this field is defined, the annotation will be treated as a range' },
  {
    key: 'title',
  },
  {
    key: 'text',
    field: (frame: DataFrame) => frame.fields.find(f => f.type === FieldType.string),
    placeholder: 'text, or the first text field',
  },
  { key: 'tags', split: ',', help: 'The results will be split on comma (,)' },
  // { key: 'userId' },
  // { key: 'login' },
  // { key: 'email' },
];

export function getAnnotationsFromData(
  data: DataFrame[],
  options?: AnnotationEventMappings
): Observable<AnnotationEvent[]> {
  return of(data).pipe(
    singleFrameFromPanelData(),
    map(frame => {
      if (!frame?.length) {
        return [];
      }

      let hasTime = false;
      let hasText = false;
      const byName: KeyValue<Field> = {};

      for (const f of frame.fields) {
        const name = getFieldDisplayName(f, frame);
        byName[name.toLowerCase()] = f;
      }

      if (!options) {
        options = {};
      }

      const fields: AnnotationEventFieldSetter[] = [];

      for (const evts of annotationEventNames) {
        const opt = options[evts.key] || {}; //AnnotationEventFieldMapping

        if (opt.source === AnnotationEventFieldSource.Skip) {
          continue;
        }

        const setter: AnnotationEventFieldSetter = { key: evts.key, split: evts.split };

        if (opt.source === AnnotationEventFieldSource.Text) {
          setter.text = opt.value;
        } else {
          const lower = (opt.value || evts.key).toLowerCase();
          setter.field = byName[lower];

          if (!setter.field && evts.field) {
            setter.field = evts.field(frame);
          }
        }

        if (setter.field || setter.text) {
          fields.push(setter);
          if (setter.key === 'time') {
            hasTime = true;
          } else if (setter.key === 'text') {
            hasText = true;
          }
        }
      }

      if (!hasTime || !hasText) {
        return []; // throw an error?
      }

      // Add each value to the string
      const events: AnnotationEvent[] = [];

      for (let i = 0; i < frame.length; i++) {
        const anno: AnnotationEvent = {
          type: 'default',
          color: 'red',
        };

        for (const f of fields) {
          let v: any = undefined;

          if (f.text) {
            v = f.text; // TODO support templates!
          } else if (f.field) {
            v = f.field.values.get(i);
            if (v !== undefined && f.regex) {
              const match = f.regex.exec(v);
              if (match) {
                v = match[1] ? match[1] : match[0];
              }
            }
          }

          if (v !== null && v !== undefined) {
            if (f.split && typeof v === 'string') {
              v = v.split(',');
            }
            (anno as any)[f.key] = v;
          }
        }

        events.push(anno);
      }

      return events;
    })
  );
}
