import { ArrayVector, DataFrame, Field, FieldType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { lastValueFrom } from 'rxjs';

export interface DashboardData {
  dashboards: DataFrame;
  panels: DataFrame;
  panelTypes: DataFrame;
  schemaVersions: DataFrame;
}

export async function getDashboardData(): Promise<DashboardData> {
  const ds = (await getDataSourceSrv().get('-- Grafana --')) as GrafanaDatasource;
  const rsp = await lastValueFrom(
    ds.query({
      targets: [
        { refId: 'A', queryType: GrafanaQueryType.Search }, // gets all data
      ],
    } as any)
  );

  const data: DashboardData = {} as any;
  for (const f of rsp.data) {
    switch (f.name) {
      case 'dashboards':
        data.dashboards = f;
        break;
      case 'panels':
        data.panels = f;
        break;
    }
  }

  data.panelTypes = buildStatsTable(data.panels.fields.find((f) => f.name === 'Type'));
  data.schemaVersions = buildStatsTable(data.dashboards.fields.find((f) => f.name === 'SchemaVersion'));

  return data;
}

export function filterDataFrame(query: string, frame: DataFrame, ...fields: string[]): DataFrame {
  if (!frame || !query?.length) {
    return frame;
  }
  query = query.toLowerCase();

  const checkIndex: number[] = [];
  const buffer: any[][] = [];
  const copy = frame.fields.map((f, idx) => {
    if (f.type === FieldType.string && fields.includes(f.name)) {
      checkIndex.push(idx);
    }
    const v: any[] = [];
    buffer.push(v);
    return { ...f, values: new ArrayVector(v) };
  });

  for (let i = 0; i < frame.length; i++) {
    let match = false;
    for (const idx of checkIndex) {
      const v = frame.fields[idx].values.get(i) as string;
      if (v && v.toLowerCase().indexOf(query) >= 0) {
        match = true;
        break;
      }
    }

    if (match) {
      for (let idx = 0; idx < buffer.length; idx++) {
        buffer[idx].push(frame.fields[idx].values.get(i));
      }
    }
  }

  return {
    fields: copy,
    length: buffer[0].length,
  };
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
