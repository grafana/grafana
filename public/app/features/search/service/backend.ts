import {
  ArrayVector,
  DataFrame,
  DataFrameType,
  DataFrameView,
  Field,
  FieldType,
  getDisplayProcessor,
  Vector,
} from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { lastValueFrom } from 'rxjs';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { QueryFilters } from './types';
import { QueryResult } from '.';

// The raw restuls from query server
export interface RawIndexData {
  folder?: DataFrame;
  dashboard?: DataFrame;
  panel?: DataFrame;
}

export type rawIndexSupplier = () => Promise<RawIndexData>;

export async function getRawIndexData(): Promise<RawIndexData> {
  const ds = (await getDataSourceSrv().get('-- Grafana --')) as GrafanaDatasource;
  const rsp = await lastValueFrom(
    ds.query({
      targets: [
        { refId: 'A', queryType: GrafanaQueryType.Search }, // gets all data
      ],
    } as any)
  );

  const data: RawIndexData = {};
  for (const f of rsp.data) {
    const frame = f as DataFrame;
    for (const field of frame.fields) {
      // Parse tags/ds from JSON string
      if (field.name === 'tags' || field.name === 'datasource') {
        const values = field.values.toArray().map((v) => {
          if (v?.length) {
            try {
              const arr = JSON.parse(v);
              return arr.length ? arr : undefined;
            } catch {}
          }
          return undefined;
        });
        field.type = FieldType.other; // []string
        field.values = new ArrayVector(values);
      }

      field.display = getDisplayProcessor({ field, theme: config.theme2 });
    }
    frame.meta = {
      type: DataFrameType.DirectoryListing,
    };

    switch (frame.name) {
      case 'dashboards':
        data.dashboard = frame;
        break;
      case 'panels':
        data.panel = frame;
        break;
      case 'folders':
        data.folder = frame;
        break;
    }
  }
  return data;
}

export function buildStatsTable(field?: Field): DataFrame {
  if (!field) {
    return { length: 0, fields: [] };
  }

  const counts = new Map<any, number>();
  for (let i = 0; i < field.values.length; i++) {
    const k = field.values.get(i);
    const v = counts.get(k) ?? 0;
    counts.set(k, v + 1);
  }

  // Sort largest first
  counts[Symbol.iterator] = function* () {
    yield* [...this.entries()].sort((a, b) => b[1] - a[1]);
  };

  const keys: any[] = [];
  const vals: number[] = [];

  for (let [k, v] of counts) {
    keys.push(k);
    vals.push(v);
  }

  return {
    fields: [
      { ...field, values: new ArrayVector(keys) },
      { name: 'Count', type: FieldType.number, values: new ArrayVector(vals), config: {} },
    ],
    length: keys.length,
  };
}

export function getTermCounts(field?: Field): TermCount[] {
  if (!field) {
    return [];
  }

  const counts = new Map<any, number>();
  for (let i = 0; i < field.values.length; i++) {
    const k = field.values.get(i);
    if (k == null || !k.length) {
      continue;
    }
    if (Array.isArray(k)) {
      for (const sub of k) {
        const v = counts.get(sub) ?? 0;
        counts.set(sub, v + 1);
      }
    } else {
      const v = counts.get(k) ?? 0;
      counts.set(k, v + 1);
    }
  }

  // Sort largest first
  counts[Symbol.iterator] = function* () {
    yield* [...this.entries()].sort((a, b) => b[1] - a[1]);
  };

  const terms: TermCount[] = [];
  for (let [term, count] of counts) {
    terms.push({
      term,
      count,
    });
  }

  return terms;
}

export function filterFrame(frame: DataFrame, filter?: QueryFilters): DataFrame {
  if (!filter) {
    return frame;
  }
  const view = new DataFrameView<QueryResult>(frame);
  const keep: number[] = [];

  const ds = filter.datasource ? view.fields.datasource : undefined;
  const tags = filter.tags?.length ? view.fields.tags : undefined;

  let ok = true;
  for (let i = 0; i < view.length; i++) {
    ok = true;

    if (tags) {
      const v = tags.values.get(i);
      if (!v) {
        ok = false;
      } else {
        for (const t of filter.tags!) {
          if (!v.includes(t)) {
            ok = false;
            break;
          }
        }
      }
    }

    if (ok && ds && filter.datasource) {
      ok = false;
      const v = ds.values.get(i);
      if (v) {
        for (const d of v) {
          if (d.uid === filter.datasource) {
            ok = true;
            break;
          }
        }
      }
    }

    if (ok) {
      keep.push(i);
    }
  }

  return {
    meta: frame.meta,
    name: frame.name,
    fields: frame.fields.map((f) => ({ ...f, values: filterValues(keep, f.values) })),
    length: keep.length,
  };
}

function filterValues(keep: number[], raw: Vector<any>): Vector<any> {
  const values = new Array(keep.length);
  for (let i = 0; i < keep.length; i++) {
    values[i] = raw.get(keep[i]);
  }
  return new ArrayVector(values);
}
