import { QueryFilters, QueryResult } from './types';

import { ArrayVector, DataFrame, Field, FieldType, Vector } from '@grafana/data';
import MiniSearch from 'minisearch';

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
  url?: Vector<string>;
  name?: Vector<string>;
  description?: Vector<string>;
  panelId?: Vector<number>;
  panelType?: Vector<string>;
  tags?: Vector<string>; // JSON strings?
}

interface CompositeKey {
  kind: SearchResultKind;
  index: number;
}

export function getFrontendGrafanaSearcher(data: RawIndexData) {
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
          return 3;
        }
        if (kind === 'folder') {
          return 2;
        }
        return 1;
      },
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

  return {
    search: async (query: string, filter?: QueryFilters) => {
      const found = searcher.search(query);

      // frame fields
      const url: string[] = [];
      const kind: string[] = [];
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
        info.push(res.match); // ???
        score.push(res.score);
      }
      return {
        body: {
          fields: [
            { name: 'Kind', config: {}, type: FieldType.string, values: new ArrayVector(kind) },
            { name: 'Name', config: {}, type: FieldType.string, values: new ArrayVector(name) },
            { name: 'URL', config: {}, type: FieldType.string, values: new ArrayVector(url) },
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
    }
  }
  return input;
}
