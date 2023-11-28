import { Chance } from 'chance';

import { LibraryPanel } from '@grafana/schema';

import { LibraryElementsSearchResult } from '../../library-panels/types';

export function getLibraryElementsResponse(length = 1, overrides?: Partial<LibraryPanel>): LibraryElementsSearchResult {
  const elements: LibraryPanel[] = [];
  for (let i = 0; i < length; i++) {
    const random = Chance(i);
    const libraryElement: LibraryPanel = {
      type: 'timeseries',
      uid: random.guid(),
      version: 1,
      name: random.sentence({ words: 3 }),
      folderUid: random.guid(),
      model: {
        type: 'timeseries',
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
        options: {},
        repeatDirection: 'h',
        transformations: [],
        transparent: false,
      },
      ...overrides,
    };
    elements.push(libraryElement);
  }
  return {
    page: 1,
    perPage: 40,
    totalCount: elements.length,
    elements,
  };
}
