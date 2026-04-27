import { type SelectableValue } from '@grafana/data';
import { type DataFrame, DataFrameView } from '@grafana/data/dataframe';
import { type TermCount } from 'app/core/components/TagFilter/TagFilter';

import { type GrafanaSearcher, type LocationInfo, type QueryResponse, type SearchQuery } from './types';

// This is a dummy search useful for tests
export class DummySearcher implements GrafanaSearcher {
  expectedSearchResponse: QueryResponse | undefined;
  expectedStarsResponse: QueryResponse | undefined;
  expectedSortResponse: SelectableValue[] = [];
  expectedTagsResponse: TermCount[] = [];
  expectedLocationInfoResponse: Record<string, LocationInfo> = {};

  setExpectedSearchResult(result: DataFrame) {
    this.expectedSearchResponse = {
      view: new DataFrameView(result),
      isItemLoaded: () => true,
      loadMoreItems: () => Promise.resolve(),
      totalRows: result.length,
    };
  }

  async search(query: SearchQuery): Promise<QueryResponse> {
    return Promise.resolve(this.expectedSearchResponse!);
  }

  async starred(query: SearchQuery): Promise<QueryResponse> {
    return Promise.resolve(this.expectedStarsResponse!);
  }

  async getSortOptions(): Promise<SelectableValue[]> {
    return Promise.resolve(this.expectedSortResponse);
  }

  async tags(query: SearchQuery): Promise<TermCount[]> {
    return Promise.resolve(this.expectedTagsResponse);
  }

  async getLocationInfo(): Promise<Record<string, LocationInfo>> {
    return Promise.resolve(this.expectedLocationInfoResponse);
  }

  getFolderViewSort(): string {
    return '';
  }
}
