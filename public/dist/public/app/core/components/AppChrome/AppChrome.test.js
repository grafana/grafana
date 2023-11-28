import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KBarProvider } from 'kbar';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { DataFrameView, FieldType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { getGrafanaSearcher } from 'app/features/search/service';
import { Page } from '../Page/Page';
import { AppChrome } from './AppChrome';
const pageNav = {
    text: 'pageNav title',
    children: [
        { text: 'pageNav child1', url: '1', active: true },
        { text: 'pageNav child2', url: '2' },
    ],
};
const searchData = {
    fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: [] },
        { name: 'name', type: FieldType.string, config: {}, values: [] },
        { name: 'uid', type: FieldType.string, config: {}, values: [] },
        { name: 'url', type: FieldType.string, config: {}, values: [] },
        { name: 'tags', type: FieldType.other, config: {}, values: [] },
        { name: 'location', type: FieldType.string, config: {}, values: [] },
    ],
    length: 0,
};
const mockSearchResult = {
    isItemLoaded: jest.fn(),
    loadMoreItems: jest.fn(),
    totalRows: searchData.length,
    view: new DataFrameView(searchData),
};
const setup = (children) => {
    config.bootData.navTree = [
        {
            id: HOME_NAV_ID,
            text: 'Home',
        },
        {
            text: 'Section name',
            id: 'section',
            url: 'section',
            children: [
                { text: 'Child1', id: 'child1', url: 'section/child1' },
                { text: 'Child2', id: 'child2', url: 'section/child2' },
            ],
        },
        {
            text: 'Help',
            id: 'help',
        },
    ];
    const context = getGrafanaContextMock();
    const renderResult = render(React.createElement(KBarProvider, null,
        React.createElement(TestProvider, { grafanaContext: context },
            React.createElement(AppChrome, null,
                React.createElement("div", { "data-testid": "page-children" }, children)))));
    return { renderResult, context };
};
describe('AppChrome', () => {
    beforeAll(() => {
        // need to mock out the search service since kbar calls it to fetch recent dashboards
        jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('should render section nav model based on navId', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(React.createElement(Page, { navId: "child1" }, "Children"));
        expect(yield screen.findByTestId('page-children')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Tab Section name' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
        expect(screen.getAllByRole('tab').length).toBe(3);
    }));
    it('should render section nav model based on navId and item page nav', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(React.createElement(Page, { navId: "child1", pageNav: pageNav }, "Children"));
        expect(yield screen.findByTestId('page-children')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Tab Section name' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'pageNav title' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Tab pageNav child1' })).toBeInTheDocument();
    }));
    it('should create a skip link to skip to main content', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(React.createElement(Page, { navId: "child1" }, "Children"));
        expect(yield screen.findByRole('link', { name: 'Skip to main content' })).toBeInTheDocument();
    }));
    it('should focus the skip link on initial tab before carrying on with normal tab order', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(React.createElement(Page, { navId: "child1" }, "Children"));
        yield userEvent.keyboard('{tab}');
        const skipLink = yield screen.findByRole('link', { name: 'Skip to main content' });
        expect(skipLink).toHaveFocus();
        yield userEvent.keyboard('{tab}');
        expect(yield screen.findByRole('link', { name: 'Go to home' })).toHaveFocus();
    }));
    it('should not render a skip link if the page is chromeless', () => __awaiter(void 0, void 0, void 0, function* () {
        const { context } = setup(React.createElement(Page, { navId: "child1" }, "Children"));
        context.chrome.update({
            chromeless: true,
        });
        waitFor(() => {
            expect(screen.queryByRole('link', { name: 'Skip to main content' })).not.toBeInTheDocument();
        });
    }));
});
//# sourceMappingURL=AppChrome.test.js.map