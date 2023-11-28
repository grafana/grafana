import { __awaiter } from "tslib";
import { waitFor, within } from '@testing-library/react';
import { withinExplore } from './setup';
export const assertQueryHistoryExists = (query, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const selector = withinExplore(exploreId);
    expect(yield selector.findByText('1 queries')).toBeInTheDocument();
    const queryItem = selector.getByLabelText('Query text');
    expect(queryItem).toHaveTextContent(query);
});
export const assertQueryHistory = (expectedQueryTexts, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const selector = withinExplore(exploreId);
    yield waitFor(() => {
        expect(selector.getByText(new RegExp(`${expectedQueryTexts.length} queries`))).toBeInTheDocument();
        const queryTexts = selector.getAllByLabelText('Query text');
        expectedQueryTexts.forEach((expectedQueryText, queryIndex) => {
            expect(queryTexts[queryIndex]).toHaveTextContent(expectedQueryText);
        });
    });
});
export const assertQueryHistoryIsEmpty = (exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const selector = withinExplore(exploreId);
    const queryTexts = selector.queryAllByLabelText('Query text');
    expect(yield queryTexts).toHaveLength(0);
});
export const assertQueryHistoryComment = (expectedQueryComments, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const selector = withinExplore(exploreId);
    yield waitFor(() => {
        expect(selector.getByText(new RegExp(`${expectedQueryComments.length} queries`))).toBeInTheDocument();
        const queryComments = selector.getAllByLabelText('Query comment');
        expectedQueryComments.forEach((expectedQueryText, queryIndex) => {
            expect(queryComments[queryIndex]).toHaveTextContent(expectedQueryText);
        });
    });
});
export const assertQueryHistoryIsStarred = (expectedStars, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const selector = withinExplore(exploreId);
    // Test ID is used to avoid test timeouts reported in #70158, #59116 and #47635
    const queriesContainer = selector.getByTestId('query-history-queries-tab');
    const starButtons = within(queriesContainer).getAllByRole('button', { name: /Star query|Unstar query/ });
    yield waitFor(() => expectedStars.forEach((starred, queryIndex) => {
        expect(starButtons[queryIndex]).toHaveAccessibleName(starred ? 'Unstar query' : 'Star query');
    }));
});
export const assertQueryHistoryTabIsSelected = (tabName, exploreId = 'left') => {
    expect(withinExplore(exploreId).getByRole('tab', { name: `Tab ${tabName}`, selected: true })).toBeInTheDocument();
};
export const assertDataSourceFilterVisibility = (visible, exploreId = 'left') => {
    const filterInput = withinExplore(exploreId).queryByLabelText('Filter queries for data sources(s)');
    if (visible) {
        expect(filterInput).toBeInTheDocument();
    }
    else {
        expect(filterInput).not.toBeInTheDocument();
    }
};
export const assertQueryHistoryElementsShown = (shown, total, exploreId = 'left') => {
    expect(withinExplore(exploreId).queryByText(`Showing ${shown} of ${total}`)).toBeInTheDocument();
};
export const assertLoadMoreQueryHistoryNotVisible = (exploreId = 'left') => {
    expect(withinExplore(exploreId).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
};
//# sourceMappingURL=assert.js.map