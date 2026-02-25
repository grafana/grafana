import debounce from 'debounce-promise';
import { useEffect, useRef, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';

import { CommandPaletteAction } from '../types';
import { SEARCH_RESULTS_PRIORITY } from '../values';

const MAX_SEMANTIC_RESULTS = 10;

interface SemanticSearchResult {
  group: string;
  resource: string;
  name: string;
  title: string;
  description: string;
  score: number;
}

interface SemanticSearchResponse {
  results: SemanticSearchResult[];
}

function resourceUrl(result: SemanticSearchResult): string | undefined {
  switch (result.resource) {
    case 'dashboards':
      return `/d/${result.name}`;
    case 'folders':
      return `/dashboards/f/${result.name}`;
    default:
      return undefined;
  }
}

function resourceKindLabel(result: SemanticSearchResult): string {
  switch (result.resource) {
    case 'dashboards':
      return 'Dashboard';
    case 'folders':
      return 'Folder';
    case 'alertrules':
      return 'Alert Rule';
    case 'datasources':
      return 'Data Source';
    case 'playlists':
      return 'Playlist';
    default:
      return result.resource;
  }
}

async function getSemanticSearchResults(searchQuery: string): Promise<CommandPaletteAction[]> {
  if (searchQuery.length < 3) {
    return [];
  }

  try {
    const response = await getBackendSrv().post<SemanticSearchResponse>('/api/semantic-search', {
      query: searchQuery,
      limit: MAX_SEMANTIC_RESULTS,
    });

    if (!response?.results) {
      return [];
    }

    return response.results.map((result) => ({
      id: `semantic/${result.group}/${result.resource}/${result.name}`,
      name: result.title,
      section: 'Semantic Search',
      priority: SEARCH_RESULTS_PRIORITY,
      url: resourceUrl(result),
      subtitle: `${resourceKindLabel(result)} · ${Math.round(result.score * 100)}% match`,
    }));
  } catch {
    return [];
  }
}

const debouncedSemanticSearch = debounce(getSemanticSearchResults, 300);

export function useSemanticSearchResults({ searchQuery, show }: { searchQuery: string; show: boolean }) {
  const [semanticResults, setSemanticResults] = useState<CommandPaletteAction[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const lastTimestamp = useRef<number>(0);

  useEffect(() => {
    const timestamp = Date.now();
    if (show && searchQuery.length >= 3) {
      setIsFetching(true);
      debouncedSemanticSearch(searchQuery).then((results) => {
        if (timestamp > lastTimestamp.current) {
          setSemanticResults(results);
          setIsFetching(false);
          lastTimestamp.current = timestamp;
        }
      });
    } else {
      setSemanticResults([]);
      setIsFetching(false);
      lastTimestamp.current = timestamp;
    }
  }, [show, searchQuery]);

  return { semanticResults, isFetchingSemanticResults: isFetching };
}
