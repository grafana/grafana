import { DataFrameJSON, Labels, FieldType } from '@grafana/data';

export function newLetterRandomizer(): (v: string) => string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const charactersLength = upper.length;

  const history = new Map<string, string>();
  return (v: string) => {
    const old = history.get(v);
    if (old != null) {
      return old;
    }
    const r = [...v]
      .map((c) => {
        if (c.toLowerCase() && c !== c.toUpperCase()) {
          return lower.charAt(Math.floor(Math.random() * charactersLength));
        }
        if (c.toUpperCase() && c !== c.toUpperCase()) {
          return upper.charAt(Math.floor(Math.random() * charactersLength));
        }
        return c;
      })
      .join('');
    history.set(v, r);
    return r;
  };
}

export interface Randomize {
  names?: boolean;
  labels?: boolean;
  values?: boolean;
}

export function randomizeData(data: DataFrameJSON[], opts: Randomize): DataFrameJSON[] {
  if (!(opts.labels || opts.names || opts.values)) {
    return data;
  }

  const keepNames = new Set(['time', 'value', 'exemplar', 'traceid', 'id', 'uid', 'uuid', '__name__', 'le', 'name']);
  const rand = newLetterRandomizer();
  return data.map((s) => {
    let { schema, data } = s;
    if (schema && data) {
      if (opts.labels) {
        for (const f of schema.fields) {
          if (f.labels) {
            const labels: Labels = {};
            for (const [key, value] of Object.entries(f.labels)) {
              labels[key] = rand(value);
            }
            f.labels = labels;
          }
        }
      }
      if (opts.names) {
        for (const f of schema.fields) {
          if (f.name?.length && !keepNames.has(f.name.toLowerCase())) {
            f.name = rand(f.name);
          }
        }
      }

      // Change values
      if (opts.values) {
        schema.fields.forEach((f, idx) => {
          if (f.type === FieldType.string && data) {
            const v = data.values[idx].map((v) => rand(String(v)));
            data.values[idx] = v;
          }
        });
      }
    }
    return { schema, data };
  });
}
