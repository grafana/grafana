import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { getMockDataSources } from '../__mocks__';
import { DataSourcesListView } from './DataSourcesList';
const setup = () => {
    const store = configureStore();
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(DataSourcesListView, { dataSources: getMockDataSources(3), dataSourcesCount: 3, isLoading: false, hasCreateRights: true, hasWriteRights: true, hasExploreRights: true }))));
};
describe('<DataSourcesList>', () => {
    it('should render action bar', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(yield screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
        expect(yield screen.findByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
    }));
    it('should render list of datasources', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(yield screen.findAllByRole('listitem')).toHaveLength(3);
        expect(yield screen.findAllByRole('heading')).toHaveLength(3);
        expect(yield screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(3);
        expect(yield screen.findAllByRole('link', { name: 'Explore' })).toHaveLength(3);
    }));
    it('should render all elements in the list item', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(yield screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
        expect(yield screen.findByRole('link', { name: 'dataSource-0' })).toBeInTheDocument();
    }));
});
//# sourceMappingURL=DataSourcesList.test.js.map