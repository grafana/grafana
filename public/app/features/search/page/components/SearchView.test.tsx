import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { Observable } from 'rxjs';

import { ArrayVector, DataFrame, DataFrameView, FieldType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { StoreState } from 'app/types';

import { defaultQuery } from '../../reducers/searchQueryReducer';
import { DashboardQueryResult, getGrafanaSearcher, QueryResponse } from '../../service';
import { DashboardSearchItemType, SearchLayout } from '../../types';

import { SearchView, SearchViewProps } from './SearchView';

jest.mock('@grafana/runtime', () => {
  const originalModule = jest.requireActual('@grafana/runtime');
  return {
    ...originalModule,
    reportInteraction: jest.fn(),
    config: {
      ...originalModule.config,
      featureToggles: {
        panelTitleSearch: false,
      },
    },
  };
});

const setup = (propOverrides?: Partial<SearchViewProps>, storeOverrides?: Partial<StoreState>) => {
  const props: SearchViewProps = {
    showManage: false,
    includePanels: false,
    setIncludePanels: jest.fn(),
    keyboardEvents: {} as Observable<React.KeyboardEvent>,
    ...propOverrides,
  };

  const mockStore = configureMockStore();
  const store = mockStore({ searchQuery: defaultQuery, ...storeOverrides });
  render(
    <Provider store={store}>
      <SearchView {...props} />
    </Provider>
  );
};

describe('SearchView', () => {
  const folderData: DataFrame = {
    fields: [
      {
        name: 'kind',
        type: FieldType.string,
        config: {},
        values: new ArrayVector([DashboardSearchItemType.DashFolder]),
      },
      { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector(['My folder 1']) },
      { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector(['my-folder-1']) },
      { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector(['/my-folder-1']) },
    ],
    length: 1,
  };
  const mockSearchResult: QueryResponse = {
    isItemLoaded: jest.fn(),
    loadMoreItems: jest.fn(),
    totalRows: folderData.length,
    view: new DataFrameView<DashboardQueryResult>(folderData),
  };

  beforeAll(() => {
    jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
  });

  beforeEach(() => {
    config.featureToggles.panelTitleSearch = false;
    defaultQuery.layout = SearchLayout.Folders;
  });

  it('does not show checkboxes or manage actions if showManage is false', async () => {
    setup();
    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
    expect(screen.queryByTestId('manage-actions')).not.toBeInTheDocument();
  });

  it('shows checkboxes if showManage is true', async () => {
    setup({ showManage: true });
    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(2));
  });

  it('shows the manage actions if show manage is true and the user clicked a checkbox', async () => {
    setup({ showManage: true });
    await waitFor(() => userEvent.click(screen.getAllByRole('checkbox')[0]));

    expect(screen.queryByTestId('manage-actions')).toBeInTheDocument();
  });

  it('shows an empty state if no data returned', async () => {
    jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue({
      ...mockSearchResult,
      totalRows: 0,
      view: new DataFrameView<DashboardQueryResult>({ fields: [], length: 0 }),
    });
    setup(undefined, {
      searchQuery: {
        ...defaultQuery,
        query: 'asdfasdfasdf',
      },
    });
    await waitFor(() => expect(screen.queryByText('No results found for your query.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Clear search and filters' })).toBeInTheDocument();
  });

  describe('include panels', () => {
    it('should be enabled when layout is list', async () => {
      config.featureToggles.panelTitleSearch = true;
      defaultQuery.layout = SearchLayout.List;
      setup();

      await waitFor(() => expect(screen.getByLabelText(/include panels/i)).toBeInTheDocument());
      expect(screen.getByTestId('include-panels')).toBeEnabled();
    });
    it('should be disabled when layout is folder', async () => {
      config.featureToggles.panelTitleSearch = true;
      setup();

      await waitFor(() => expect(screen.getByLabelText(/include panels/i)).toBeInTheDocument());
      expect(screen.getByTestId('include-panels')).toBeDisabled();
    });
  });
});
