import { QueryFilters, QueryResult } from './types';

import { DataFrame, Field } from '@grafana/data';
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
  url?: Field;
  name?: Field;
  description?: Field;
  panelId?: Field;
  panelType?: Field;
  tags?: Field;
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
      const field = (doc as any)[name] as Field;
      if (!field) {
        return undefined;
      }
      return field.values.get(doc.index);
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
      const match: QueryResult[] = [];
      const found = searcher.search(query);
      for (const res of found) {
        const key = res.id as CompositeKey;
        const input = lookup.get(key.kind);
        if (!input) {
          continue;
        }
        match.push({
          kind: key.kind,
          name: input.name?.values.get(key.index) ?? '?',
          url: '?',
        });
      }
      return {
        match,
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
      case 'Name':
        input.name = field;
        break;
      case 'Description':
        input.description = field;
        break;
    }
  }
  return input;
}
