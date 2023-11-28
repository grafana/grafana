import { __awaiter } from "tslib";
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { assertIsDefined } from 'test/helpers/asserts';
import { selectors } from '@grafana/e2e-selectors';
import { wellFormedDashboard, wellFormedEmptyFolder, wellFormedFolder } from '../fixtures/dashboardsTreeItem.fixture';
import { SelectionState } from '../types';
import { DashboardsTree } from './DashboardsTree';
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
describe('browse-dashboards DashboardsTree', () => {
    const WIDTH = 800;
    const HEIGHT = 600;
    const folder = wellFormedFolder(1);
    const emptyFolderIndicator = wellFormedEmptyFolder();
    const dashboard = wellFormedDashboard(2);
    const noop = () => { };
    const isSelected = () => SelectionState.Unselected;
    const allItemsAreLoaded = () => true;
    const requestLoadMore = () => Promise.resolve();
    it('renders a dashboard item', () => {
        render(React.createElement(DashboardsTree, { canSelect: true, items: [dashboard], isSelected: isSelected, width: WIDTH, height: HEIGHT, onFolderClick: noop, onItemSelectionChange: noop, onAllSelectionChange: noop, isItemLoaded: allItemsAreLoaded, requestLoadMore: requestLoadMore }));
        expect(screen.queryByText(dashboard.item.title)).toBeInTheDocument();
        expect(screen.queryByText(assertIsDefined(dashboard.item.tags)[0])).toBeInTheDocument();
        expect(screen.getByTestId(selectors.pages.BrowseDashboards.table.checkbox(dashboard.item.uid))).toBeInTheDocument();
    });
    it('does not render checkbox when disabled', () => {
        render(React.createElement(DashboardsTree, { canSelect: false, items: [dashboard], isSelected: isSelected, width: WIDTH, height: HEIGHT, onFolderClick: noop, onItemSelectionChange: noop, onAllSelectionChange: noop, isItemLoaded: allItemsAreLoaded, requestLoadMore: requestLoadMore }));
        expect(screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(dashboard.item.uid))).not.toBeInTheDocument();
    });
    it('renders a folder item', () => {
        render(React.createElement(DashboardsTree, { canSelect: true, items: [folder], isSelected: isSelected, width: WIDTH, height: HEIGHT, onFolderClick: noop, onItemSelectionChange: noop, onAllSelectionChange: noop, isItemLoaded: allItemsAreLoaded, requestLoadMore: requestLoadMore }));
        expect(screen.queryByText(folder.item.title)).toBeInTheDocument();
    });
    it('calls onFolderClick when a folder button is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        const handler = jest.fn();
        render(React.createElement(DashboardsTree, { canSelect: true, items: [folder], isSelected: isSelected, width: WIDTH, height: HEIGHT, onFolderClick: handler, onItemSelectionChange: noop, onAllSelectionChange: noop, isItemLoaded: allItemsAreLoaded, requestLoadMore: requestLoadMore }));
        const folderButton = screen.getByLabelText(`Expand folder ${folder.item.title}`);
        yield userEvent.click(folderButton);
        expect(handler).toHaveBeenCalledWith(folder.item.uid, true);
    }));
    it('renders empty folder indicators', () => {
        render(React.createElement(DashboardsTree, { canSelect: true, items: [emptyFolderIndicator], isSelected: isSelected, width: WIDTH, height: HEIGHT, onFolderClick: noop, onItemSelectionChange: noop, onAllSelectionChange: noop, isItemLoaded: allItemsAreLoaded, requestLoadMore: requestLoadMore }));
        expect(screen.queryByText('No items')).toBeInTheDocument();
    });
});
//# sourceMappingURL=DashboardsTree.test.js.map