import {
  type DataFrame,
  type DisplayValue,
  fieldReducers,
  getFieldDisplayName,
  getFieldDisplayValuesProxy,
  type InterpolateFunction,
  ReducerID,
  type ScopedVars,
} from '@grafana/data';
import { getFieldAccessor } from 'app/features/templating/fieldAccessorCache';

// Field paths follow the same rules as the scenes variable regex.
const REDUCER_MACRO =
  /\$\{__data((?:\.[^:^{}\[\]]+|\["[^"]*"\]|\['[^']*'\]|\[[^\]"']*\])+):reduce:(\w+)(?::([^}]+))?\}/g;

// These return a list of values, not one value.
const LIST_REDUCERS = new Set<string>([ReducerID.allValues, ReducerID.uniqueValues]);

/** The reducers `${__data.fields.x:reduce:<id>}` accepts. */
export function getMacroReducers() {
  return fieldReducers.list().filter((reducer) => !LIST_REDUCERS.has(reducer.id));
}

export function readsSeriesByName(content: string): boolean {
  return Array.from(content.matchAll(REDUCER_MACRO)).some(([, path]) => path.startsWith('.series['));
}

/**
 * Adds `${__data.fields.x:reduce:<id>}` to `replaceVariables`. Each field is reduced on its own,
 * across the frame in the data context.
 *
 * Each result is passed as a scoped var, not written into the text. This way the format still
 * escapes it, and a `$` in the data is not interpolated.
 */
export function withReducerMacros(replaceVariables: InterpolateFunction): InterpolateFunction {
  return (text, scopedVars, format) => {
    const frame = scopedVars?.__dataContext?.value.frame;
    if (!frame || !text.includes(':reduce:')) {
      return replaceVariables(text, scopedVars, format);
    }

    const frames: DataFrame[] = scopedVars?.__dataContext?.value.data ?? [frame];
    const resolved: ScopedVars = { ...scopedVars };
    let count = 0;

    const replaced = text.replace(REDUCER_MACRO, (match, rawPath: string, reducerId: string, macroFormat?: string) => {
      const reducer = fieldReducers.getIfExists(reducerId);
      const name = `__textReduced${count++}`;

      // Kept as a scoped var, not left in the text, so Per row mode can't resolve it against the row.
      if (!reducer || LIST_REDUCERS.has(reducer.id)) {
        resolved[name] = { text: match, value: match };
        return `\${${name}}`;
      }

      const path = rawPath.startsWith('.') ? rawPath.slice(1) : rawPath;
      const fields = getFieldDisplayValuesProxy({ frame, reducer: reducer.id });
      const series = getSeriesDisplayValues(frames, reducer.id);
      const value = String(getFieldAccessor(path)({ name: frame.name, refId: frame.refId, fields, series }) ?? '');

      resolved[name] = { text: value, value };

      return macroFormat ? `\${${name}:${macroFormat}}` : `\${${name}}`;
    });

    return replaceVariables(replaced, resolved, format);
  };
}

function getSeriesDisplayValues(frames: DataFrame[], reducer: string): Record<string, DisplayValue | undefined> {
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === Symbol.toPrimitive) {
          return () => '';
        }

        for (const frame of frames) {
          const field = frame.fields.find((candidate) => getFieldDisplayName(candidate, frame, frames) === key);

          if (field) {
            return getFieldDisplayValuesProxy({ frame: { ...frame, fields: [field] }, reducer })[0];
          }
        }

        return undefined;
      },
    }
  );
}
