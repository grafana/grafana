import { SelectableValue, DataFrame, DataFrameView } from '@grafana/data';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';

import { GrafanaSearcher, QueryResponse, SearchQuery } from '.';

// This is a dummy search useful for tests
export class DummySearcher implements GrafanaSearcher {
  expectedSearchResponse: QueryResponse | undefined;
  expectedStarsResponse: QueryResponse | undefined;
  expectedSortResponse: SelectableValue[] = [];
  expectedTagsResponse: TermCount[] = [];

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

  getFolderViewSort(): string {
    return '';
  }
}
