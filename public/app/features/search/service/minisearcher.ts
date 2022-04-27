import { isArray, isString } from 'lodash';
import MiniSearch from 'minisearch';

import { ArrayVector, DataFrame, DataSourceRef, Field, FieldType, getDisplayProcessor, Vector } from '@grafana/data';
import { config } from '@grafana/runtime';

import { filterFrame, getRawIndexData, RawIndexData, rawIndexSupplier } from './backend';
import { GrafanaSearcher, QueryFilters, QueryResponse } from './types';

import { LocationInfo } from '.';

export type SearchResultKind = keyof RawIndexData;

interface InputDoc {
  kind: SearchResultKind;
  index: number;

  // Fields
  id?: Vector<number>;
  url?: Vector<string>;
  uid?: Vector<string>;
  name?: Vector<string>;
  folder?: Vector<number>;
  description?: Vector<string>;
  dashboardID?: Vector<number>;
  location?: Vector<LocationInfo[]>;
  datasource?: Vector<DataSourceRef[]>;
  type?: Vector<string>;
  tags?: Vector<string[]>; // JSON strings?
}

interface CompositeKey {
  kind: SearchResultKind;
  index: number;
}

// This implements search in the frontend using the minisearch library
export class MiniSearcher implements GrafanaSearcher {
  lookup = new Map<SearchResultKind, InputDoc>();
  data: RawIndexData = {};
  index?: MiniSearch<InputDoc>;

  constructor(private supplier: rawIndexSupplier = getRawIndexData) {
    // waits for first request to load data
  }

  private async initIndex() {
    const data = await this.supplier();

    const searcher = new MiniSearch<InputDoc>({
      idField: '__id',
      fields: ['name', 'description', 'tags', 'type', 'tags'], // fields to index for full-text search
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
        prefix: true,
        fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      },
      extractField: (doc, name) => {
        // return a composite key for the id
        if (name === '__id') {
          return {
            kind: doc.kind,
            index: doc.index,
          } as any;
        }
        const values = (doc as any)[name] as Vector;
        if (!values) {
          return '';
        }
        const value = values.get(doc.index);
        if (isString(value)) {
          return value as string;
        }
        if (isArray(value)) {
          return value.join(' ');
        }
        return JSON.stringify(value);
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
    const folderIDToIndex = new Map<number, number>();
    const folder = lookup.get('folder');
    const dashboard = lookup.get('dashboard');
    const panel = lookup.get('panel');
    if (folder?.id) {
      for (let i = 0; i < folder.id?.length; i++) {
        folderIDToIndex.set(folder.id.get(i), i);
      }
    }

    if (dashboard?.id && panel?.dashboardID && dashboard.url) {
      let location: LocationInfo[][] = new Array(dashboard.id.length);
      const dashIDToIndex = new Map<number, number>();
      for (let i = 0; i < dashboard.id?.length; i++) {
        dashIDToIndex.set(dashboard.id.get(i), i);
        const folderId = dashboard.folder?.get(i);
        if (folderId != null) {
          const index = folderIDToIndex.get(folderId);
          const name = folder?.name?.get(index!);
          if (name) {
            location[i] = [
              {
                kind: 'folder',
                name,
              },
            ];
          }
        }
      }
      dashboard.location = new ArrayVector(location); // folder name

      location = new Array(panel.dashboardID.length);
      const urls: string[] = new Array(location.length);
      for (let i = 0; i < panel.dashboardID.length; i++) {
        const dashboardID = panel.dashboardID.get(i);
        const index = dashIDToIndex.get(dashboardID);
        if (index != null) {
          const idx = panel.id?.get(i);
          urls[i] = dashboard.url.get(index) + '?viewPanel=' + idx;

          const parent = dashboard.location.get(index) ?? [];
          const name = dashboard.name?.get(index) ?? '?';
          location[i] = [...parent, { kind: 'dashboard', name }];
        }
      }
      panel.url = new ArrayVector(urls);
      panel.location = new ArrayVector(location);
    }

    this.index = searcher;
    this.data = data;
    this.lookup = lookup;
  }

  async search(query: string, filter?: QueryFilters): Promise<QueryResponse> {
    if (!this.index) {
      await this.initIndex();
    }

    // empty query can return everything
    if (!query && this.data.dashboard) {
      return {
        body: filterFrame(this.data.dashboard, filter),
      };
    }

    const found = this.index!.search(query);

    // frame fields
    const url: string[] = [];
    const kind: string[] = [];
    const type: string[] = [];
    const name: string[] = [];
    const tags: string[][] = [];
    const location: LocationInfo[][] = [];
    const datasource: DataSourceRef[][] = [];
    const info: any[] = [];
    const score: number[] = [];

    for (const res of found) {
      const key = res.id as CompositeKey;
      const index = key.index;
      const input = this.lookup.get(key.kind);
      if (!input) {
        continue;
      }

      if (filter && !shouldKeep(filter, input, index)) {
        continue;
      }

      url.push(input.url?.get(index) ?? '?');
      location.push(input.location?.get(index) as any);
      datasource.push(input.datasource?.get(index) as any);
      tags.push(input.tags?.get(index) as any);
      kind.push(key.kind);
      name.push(input.name?.get(index) ?? '?');
      type.push(input.type?.get(index)!);
      info.push(res.match); // ???
      score.push(res.score);
    }
    const fields: Field[] = [
      { name: 'kind', config: {}, type: FieldType.string, values: new ArrayVector(kind) },
      { name: 'name', config: {}, type: FieldType.string, values: new ArrayVector(name) },
      {
        name: 'url',
        config: {},
        type: FieldType.string,
        values: new ArrayVector(url),
      },
      { name: 'type', config: {}, type: FieldType.string, values: new ArrayVector(type) },
      { name: 'info', config: {}, type: FieldType.other, values: new ArrayVector(info) },
      { name: 'tags', config: {}, type: FieldType.other, values: new ArrayVector(tags) },
      { name: 'location', config: {}, type: FieldType.other, values: new ArrayVector(location) },
      { name: 'datasource', config: {}, type: FieldType.other, values: new ArrayVector(datasource) },
      { name: 'score', config: {}, type: FieldType.number, values: new ArrayVector(score) },
    ];
    for (const field of fields) {
      field.display = getDisplayProcessor({ field, theme: config.theme2 });
    }
    return {
      body: {
        fields,
        length: kind.length,
      },
    };
  }
}

function shouldKeep(filter: QueryFilters, doc: InputDoc, index: number): boolean {
  if (filter.tags) {
    const tags = doc.tags?.get(index);
    if (!tags?.length) {
      return false;
    }
    for (const t of filter.tags) {
      if (!tags.includes(t)) {
        return false;
      }
    }
  }

  let keep = true;
  // Any is OK
  if (filter.datasource) {
    keep = false;
    const dss = doc.datasource?.get(index);
    if (dss) {
      for (const ds of dss) {
        if (ds.uid === filter.datasource) {
          keep = true;
          break;
        }
      }
    }
  }
  return keep;
}

function getInputDoc(kind: SearchResultKind, frame: DataFrame): InputDoc {
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
      case 'Tags':
      case 'tags':
        input.tags = field.values;
        break;
      case 'DashboardID':
      case 'dashboardID':
        input.dashboardID = field.values;
        break;
      case 'Type':
      case 'type':
        input.type = field.values;
        break;
      case 'folderID':
      case 'FolderID':
        input.folder = field.values;
        break;
      case 'datasource':
      case 'dsList':
      case 'DSList':
        input.datasource = field.values;
        break;
    }
  }
  return input;
}
