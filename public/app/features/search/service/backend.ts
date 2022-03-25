import { ArrayVector, DataFrame, DataFrameType, Field, FieldType, getDisplayProcessor } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { lastValueFrom } from 'rxjs';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

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
