import { GrafanaSearcher, QueryFilters } from './types';

import { ArrayVector, DataFrame, FieldType, Vector } from '@grafana/data';
import MiniSearch from 'minisearch';
import { getDataSourceSrv } from '@grafana/runtime';
import { GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { lastValueFrom } from 'rxjs';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

// The raw restuls from query server
export interface RawIndexData {
  dashboard?: DataFrame;
  panel?: DataFrame;
  folder?: DataFrame;
}

export type SearchResultKind = keyof RawIndexData;

interface InputDoc {
  kind: SearchResultKind;
  index: number;

  // Fields
  id?: Vector<number>;
  url?: Vector<string>;
  uid?: Vector<string>;
  name?: Vector<string>;
  description?: Vector<string>;
  dashboardID?: Vector<number>;
  type?: Vector<string>;
  tags?: Vector<string>; // JSON strings?
}

interface CompositeKey {
  kind: SearchResultKind;
  index: number;
}

export function getFrontendGrafanaSearcher(data: RawIndexData): GrafanaSearcher {
  const searcher = new MiniSearch<InputDoc>({
    idField: '__id',
    fields: ['name', 'description', 'tags'], // fields to index for full-text search
    searchOptions: {
      boost: {
        name: 3,
        description: 1,
      },
      // boost dashboard matches first
      boostDocument: (documentId: any, term: string) => {
        const kind = documentId.kind;
        if (kind === 'dashboard') {
          return 1.4;
        }
        if (kind === 'folder') {
          return 1.2;
        }
        return 1;
      },
      prefix: true, // (term) => term.length > 3,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
    },
    extractField: (doc, name) => {
      // return a composite key for the id
      if (name === '__id') {
        return {
          kind: doc.kind,
          index: doc.index,
        };
      }
      const values = (doc as any)[name] as Vector;
      if (!values) {
        return undefined;
      }
      return values.get(doc.index);
    },
  });

  const lookup = new Map<SearchResultKind, InputDoc>();
  for (const [key, frame] of Object.entries(data)) {
    const kind = key as SearchResultKind;
    const input = getInputDoc(kind, frame);
    lookup.set(kind, input);
    for (let i = 0; i < frame.length; i++) {
      input.index = i;
      searcher.add(input);
    }
  }

  // Construct the URL field for each panel
  if (true) {
    const dashboard = lookup.get('dashboard');
    const panel = lookup.get('panel');
    if (dashboard?.id && panel?.dashboardID && dashboard.url) {
      const dashIDToIndex = new Map<number, number>();
      for (let i = 0; i < dashboard.id?.length; i++) {
        dashIDToIndex.set(dashboard.id.get(i), i);
      }

      const urls: string[] = new Array(panel.dashboardID.length);
      for (let i = 0; i < panel.dashboardID.length; i++) {
        const dashboardID = panel.dashboardID.get(i);
        const index = dashIDToIndex.get(dashboardID);
        if (index != null) {
          urls[i] = dashboard.url.get(index) + '?viewPanel=' + panel.id?.get(i);
        }
      }
      panel.url = new ArrayVector(urls);
    }
  }

  return {
    search: async (query: string, filter?: QueryFilters) => {
      const found = searcher.search(query);

      // frame fields
      const url: string[] = [];
      const kind: string[] = [];
      const type: string[] = [];
      const name: string[] = [];
      const info: any[] = [];
      const score: number[] = [];

      for (const res of found) {
        const key = res.id as CompositeKey;
        const index = key.index;
        const input = lookup.get(key.kind);
        if (!input) {
          continue;
        }

        url.push(input.url?.get(index) ?? '?');
        kind.push(key.kind);
        name.push(input.name?.get(index) ?? '?');
        type.push(input.type?.get(index) as any);
        info.push(res.match); // ???
        score.push(res.score);
      }
      return {
        body: {
          fields: [
            { name: 'Kind', config: {}, type: FieldType.string, values: new ArrayVector(kind) },
            { name: 'Name', config: {}, type: FieldType.string, values: new ArrayVector(name) },
            {
              name: 'URL',
              config: {
                links: [
                  {
                    title: 'view',
                    url: '?',
                    onClick: (evt) => {
                      const { field, rowIndex } = evt.origin;
                      if (field && rowIndex != null) {
                        const url = field.values.get(rowIndex) as string;
                        window.location.href = url; // HACK!
                      }
                    },
                  },
                ],
              },
              type: FieldType.string,
              values: new ArrayVector(url),
            },
            { name: 'type', config: {}, type: FieldType.other, values: new ArrayVector(type) },
            { name: 'info', config: {}, type: FieldType.other, values: new ArrayVector(info) },
            { name: 'score', config: {}, type: FieldType.number, values: new ArrayVector(score) },
          ],
          length: url.length,
        },
      };
    },
  };
}

export function getInputDoc(kind: SearchResultKind, frame: DataFrame): InputDoc {
  const input: InputDoc = {
    kind,
    index: 0,
  };
  for (const field of frame.fields) {
    switch (field.name) {
      case 'name':
      case 'Name':
        input.name = field.values;
        break;
      case 'Description':
      case 'Description':
        input.description = field.values;
        break;
      case 'url':
      case 'URL':
        input.url = field.values;
        break;
      case 'uid':
      case 'UID':
        input.uid = field.values;
        break;
      case 'id':
      case 'ID':
        input.id = field.values;
        break;
      case 'DashboardID':
      case 'dashboardID':
        input.dashboardID = field.values;
        break;
      case 'Type':
      case 'type':
        input.type = field.values;
        break;
    }
  }
  return input;
}

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
    switch (f.name) {
      case 'dashboards':
        data.dashboard = f;
        break;
      case 'panels':
        data.panel = f;
        break;
      case 'folders':
        data.folder = f;
        break;
    }
  }
  return data;
}
