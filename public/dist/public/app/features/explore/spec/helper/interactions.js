import { __awaiter } from "tslib";
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectors } from '@grafana/e2e-selectors';
import { withinExplore } from './setup';
export const changeDatasource = (name) => __awaiter(void 0, void 0, void 0, function* () {
    const datasourcePicker = (yield screen.findByTestId(selectors.components.DataSourcePicker.container)).children[0];
    fireEvent.keyDown(datasourcePicker, { keyCode: 40 });
    const option = screen.getByText(name);
    fireEvent.click(option);
});
export const inputQuery = (query, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const input = withinExplore(exploreId).getByRole('textbox', { name: 'query' });
    yield userEvent.clear(input);
    yield userEvent.type(input, query);
});
export const runQuery = (exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const explore = withinExplore(exploreId);
    const toolbar = within(explore.getByLabelText('Explore toolbar'));
    const button = toolbar.getByRole('button', { name: /run query/i });
    yield userEvent.click(button);
});
export const openQueryHistory = (exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const selector = withinExplore(exploreId);
    const button = selector.getByRole('button', { name: 'Query history' });
    yield userEvent.click(button);
    expect(yield selector.findByPlaceholderText('Search queries')).toBeInTheDocument();
});
export const closeQueryHistory = (exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const closeButton = withinExplore(exploreId).getByRole('button', { name: 'Close query history' });
    yield userEvent.click(closeButton);
});
export const switchToQueryHistoryTab = (name, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    yield userEvent.click(withinExplore(exploreId).getByRole('tab', { name: `Tab ${name}` }));
});
export const selectStarredTabFirst = (exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const checkbox = withinExplore(exploreId).getByRole('checkbox', {
        name: /Change the default active tab from “Query history” to “Starred”/,
    });
    yield userEvent.click(checkbox);
});
export const selectOnlyActiveDataSource = (exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const checkbox = withinExplore(exploreId).getByLabelText(/Only show queries for data source currently active.*/);
    yield userEvent.click(checkbox);
});
export const starQueryHistory = (queryIndex, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    yield invokeAction(queryIndex, 'Star query', exploreId);
});
export const commentQueryHistory = (queryIndex, comment, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    yield invokeAction(queryIndex, 'Add comment', exploreId);
    const input = withinExplore(exploreId).getByPlaceholderText('An optional description of what the query does.');
    yield userEvent.clear(input);
    yield userEvent.type(input, comment);
    yield invokeAction(queryIndex, 'Save comment', exploreId);
});
export const deleteQueryHistory = (queryIndex, exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    yield invokeAction(queryIndex, 'Delete query', exploreId);
});
export const loadMoreQueryHistory = (exploreId = 'left') => __awaiter(void 0, void 0, void 0, function* () {
    const button = withinExplore(exploreId).getByRole('button', { name: 'Load more' });
    yield userEvent.click(button);
});
const invokeAction = (queryIndex, actionAccessibleName, exploreId) => __awaiter(void 0, void 0, void 0, function* () {
    const selector = withinExplore(exploreId);
    const buttons = selector.getAllByRole('button', { name: actionAccessibleName });
    yield userEvent.click(buttons[queryIndex]);
});
//# sourceMappingURL=interactions.js.map