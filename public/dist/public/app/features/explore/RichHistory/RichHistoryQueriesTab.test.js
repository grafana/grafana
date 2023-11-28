import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { setDataSourceSrv } from '@grafana/runtime';
import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
const setup = (propOverrides) => {
    const props = {
        queries: [],
        totalQueries: 0,
        loading: false,
        activeDatasourceInstance: 'test-ds',
        updateFilters: jest.fn(),
        clearRichHistoryResults: jest.fn(),
        loadMoreRichHistory: jest.fn(),
        richHistorySearchFilters: {
            search: '',
            sortOrder: SortOrder.Descending,
            datasourceFilters: ['test-ds'],
            from: 0,
            to: 30,
            starred: false,
        },
        richHistorySettings: {
            retentionPeriod: 30,
            activeDatasourceOnly: false,
            lastUsedDatasourceFilters: [],
            starredTabAsFirstTab: false,
        },
        exploreId: 'left',
        height: 100,
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(RichHistoryQueriesTab, Object.assign({}, props)));
};
describe('RichHistoryQueriesTab', () => {
    beforeAll(() => {
        setDataSourceSrv({
            getList() {
                return [];
            },
        });
    });
    it('should render', () => {
        setup();
        expect(screen.queryByText('Filter history')).toBeInTheDocument();
    });
    it('should not regex escape filter input', () => {
        const updateFiltersSpy = jest.fn();
        setup({ updateFilters: updateFiltersSpy });
        const input = screen.getByPlaceholderText(/search queries/i);
        fireEvent.change(input, { target: { value: '|=' } });
        expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ search: '|=' }));
    });
});
//# sourceMappingURL=RichHistoryQueriesTab.test.js.map