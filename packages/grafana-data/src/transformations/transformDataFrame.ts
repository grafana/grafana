import { cloneDeep } from 'lodash';
import { from, type MonoTypeOperatorFunction, type Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { type DataFrame } from '../types/dataFrame';
import {
  type CustomTransformOperator,
  type DataTransformContext,
  type DataTransformerConfig,
  type DataTransformerInfo,
  type FrameMatcher,
} from '../types/transformations';

import { getFrameMatchers } from './matchers';
import { standardTransformersRegistry, type TransformerRegistryItem } from './standardTransformersRegistry';

// Cache in-flight (and resolved) transformation promises so concurrent callers
// share a single resolution rather than each invoking info.transformation()
// independently. Failures evict the entry so the next caller can retry.
const transformationPromises = new Map<string, Promise<DataTransformerInfo>>();

const getTransformation = (info: TransformerRegistryItem): Promise<DataTransformerInfo> => {
  const pending = transformationPromises.get(info.id);
  if (pending) {
    return pending;
  }

  const promise = Promise.resolve()
    .then(() => info.transformation())
    .catch((err) => {
      transformationPromises.delete(info.id);
      throw err;
    });

  transformationPromises.set(info.id, promise);
  return promise;
};

/**
 * Test-only: clears the in-flight/resolved transformation promise cache so
 * tests can start from a known state. Not exported from the package index.
 */
export const __resetTransformationCacheForTests = () => {
  transformationPromises.clear();
};

const getOperator =
  (config: DataTransformerConfig, ctx: DataTransformContext): MonoTypeOperatorFunction<DataFrame[]> =>
  (source) => {
    const info = standardTransformersRegistry.get(config.id);

    if (!info) {
      return source;
    }

    const matcher = config.filter?.options ? getFrameMatchers(config.filter) : undefined;

    return source.pipe(
      mergeMap((before) =>
        from(getTransformation(info)).pipe(
          mergeMap((transformation) => {
            const defaultOptions = transformation.defaultOptions ?? {};
            const options = { ...defaultOptions, ...config.options };

            // when running within Scenes, we can skip var interpolation, since it's already handled upstream
            const isScenes = window.__grafanaSceneContext != null;

            const interpolated = isScenes
              ? options
              : deepIterate(cloneDeep(options), (v) => {
                  if (typeof v === 'string') {
                    return ctx.interpolate(v);
                  }
                  return v;
                });

            return of(filterInput(before, matcher)).pipe(
              transformation.operator(interpolated, ctx),
              postProcessTransform(before, info, matcher)
            );
          })
        )
      )
    );
  };

function filterInput(data: DataFrame[], matcher?: FrameMatcher) {
  if (matcher) {
    return data.filter((v) => matcher(v));
  }
  return data;
}

const postProcessTransform =
  (before: DataFrame[], info: TransformerRegistryItem, matcher?: FrameMatcher): MonoTypeOperatorFunction<DataFrame[]> =>
  (source) =>
    source.pipe(
      map((after) => {
        if (after === before) {
          return after;
        }

        // Add back the filtered out frames
        if (matcher) {
          // keep the frame order the same
          let insert = 0;
          const append = before.filter((v, idx) => {
            const keep = !matcher(v);
            if (keep && !insert) {
              insert = idx;
            }
            return keep;
          });
          if (append.length) {
            after.splice(insert, 0, ...append);
          }
        }
        return after;
      })
    );

/**
 * Apply configured transformations to the input data
 */
export function transformDataFrame(
  options: Array<DataTransformerConfig | CustomTransformOperator>,
  data: DataFrame[],
  ctx?: DataTransformContext
): Observable<DataFrame[]> {
  const stream = of<DataFrame[]>(data);

  if (!options.length) {
    return stream;
  }

  const operators: Array<MonoTypeOperatorFunction<DataFrame[]>> = [];
  const context = ctx ?? { interpolate: (str) => str };

  for (let index = 0; index < options.length; index++) {
    const config = options[index];

    if (isCustomTransformation(config)) {
      operators.push(config(context));
    } else {
      if (config.disabled) {
        continue;
      }
      operators.push(getOperator(config, context));
    }
  }

  // @ts-ignore TypeScript has a hard time understanding this construct
  return stream.pipe.apply(stream, operators);
}

function isCustomTransformation(t: DataTransformerConfig | CustomTransformOperator): t is CustomTransformOperator {
  return typeof t === 'function';
}

function deepIterate<T extends object>(obj: T, doSomething: (current: any) => any): T;
// eslint-disable-next-line no-redeclare
function deepIterate(obj: any, doSomething: (current: any) => any): any {
  if (Array.isArray(obj)) {
    return obj.map((o) => deepIterate(o, doSomething));
  }

  if (typeof obj === 'object') {
    for (const key in obj) {
      obj[key] = deepIterate(obj[key], doSomething);
    }

    return obj;
  } else {
    return doSomething(obj) ?? obj;
  }
}
