import { isString } from 'lodash';
import { Observable, of, OperatorFunction } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import {
  AnnotationEvent,
  AnnotationEventFieldSource,
  AnnotationEventMappings,
  AnnotationQuery,
  AnnotationSupport,
  DataFrame,
  DataSourceApi,
  DataTransformContext,
  Field,
  FieldType,
  getFieldDisplayName,
  KeyValue,
  standardTransformers,
} from '@grafana/data';
import { config } from 'app/core/config';

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
          refId: 'annotation_query',
          query,
        },
        mappings: {},
      };
    }
    return json as AnnotationQuery;
  },

  /**
   * Default will just return target from the annotation.
   */
  prepareQuery: (anno: AnnotationQuery) => anno.target,

  /**
   * Provides default processing from dataFrame to annotation events.
   */
  processEvents: (anno: AnnotationQuery, data: DataFrame[]) => {
    return getAnnotationsFromData(data, anno.mappings);
  },
};

/**
 * Flatten all frames into a single frame with mergeTransformer.
 */

export function singleFrameFromPanelData(): OperatorFunction<DataFrame[], DataFrame | undefined> {
  return (source) =>
    source.pipe(
      mergeMap((data) => {
        if (!data?.length) {
          return of(undefined);
        }

        if (data.length === 1) {
          return of(data[0]);
        }

        const ctx: DataTransformContext = {
          interpolate: (v: string) => v,
        };

        return of(data).pipe(
          standardTransformers.mergeTransformer.operator({}, ctx),
          map((d) => d[0])
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

// These fields get added to the standard UI
export const annotationEventNames: AnnotationFieldInfo[] = [
  {
    key: 'time',
    field: (frame: DataFrame) => frame.fields.find((f) => f.type === FieldType.time),
    placeholder: 'time, or the first time field',
  },
  { key: 'timeEnd', help: 'When this field is defined, the annotation will be treated as a range' },
  {
    key: 'title',
  },
  {
    key: 'text',
    field: (frame: DataFrame) => frame.fields.find((f) => f.type === FieldType.string),
    placeholder: 'text, or the first text field',
  },
  { key: 'tags', split: ',', help: 'The results will be split on comma (,)' },
  {
    key: 'id',
  },
];

export const publicDashboardEventNames: AnnotationFieldInfo[] = [
  {
    key: 'color',
  },
  {
    key: 'isRegion',
  },
  {
    key: 'source',
  },
];

// Given legacy infrastructure, alert events are passed though the same annotation
// pipeline, but include fields that should not be exposed generally
const alertEventAndAnnotationFields: AnnotationFieldInfo[] = [
  ...(config.isPublicDashboardView ? publicDashboardEventNames : []),
  ...annotationEventNames,
  { key: 'userId' },
  { key: 'login' },
  { key: 'email' },
  { key: 'prevState' },
  { key: 'newState' },
  { key: 'data' as any },
  { key: 'panelId' },
  { key: 'alertId' },
  { key: 'dashboardId' },
  { key: 'dashboardUID' },
];

export function getAnnotationsFromData(
  data: DataFrame[],
  options?: AnnotationEventMappings
): Observable<AnnotationEvent[]> {
  return of(data).pipe(
    singleFrameFromPanelData(),
    map((frame) => {
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

      for (const evts of alertEventAndAnnotationFields) {
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
        console.error('Cannot process annotation fields. No time or text present.');
        return [];
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

// These opt outs are here only for quicker and easier migration to react based annotations editors and because
// annotation support API needs some work to support less "standard" editors like prometheus and here it is not
// polluting public API.

const legacyRunner = [
  'prometheus',
  'loki',
  'elasticsearch',
  'grafana-opensearch-datasource', // external
];

/**
 * Opt out of using the default mapping functionality on frontend.
 */
export function shouldUseMappingUI(datasource: DataSourceApi): boolean {
  const { type } = datasource;
  return !(
    type === 'datasource' || //  ODD behavior for "-- Grafana --" datasource
    legacyRunner.includes(type)
  );
}

/**
 * Use legacy runner. Used only as an escape hatch for easier transition to React based annotation editor.
 */
export function shouldUseLegacyRunner(datasource: DataSourceApi): boolean {
  const { type } = datasource;
  return legacyRunner.includes(type);
}
