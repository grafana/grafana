import { __awaiter } from "tslib";
import { getByLabelText, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectors } from '@grafana/e2e-selectors';
import { wellFormedTree } from '../fixtures/dashboardsTreeItem.fixture';
import { BrowseView } from './BrowseView';
const [mockTree, { folderA, folderA_folderA, folderA_folderB, folderA_folderB_dashbdB, dashbdD, folderB_empty }] = wellFormedTree();
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
jest.mock('app/features/browse-dashboards/api/services', () => {
    const orig = jest.requireActual('app/features/browse-dashboards/api/services');
    return Object.assign(Object.assign({}, orig), { listFolders(parentUID) {
            const childrenForUID = mockTree
                .filter((v) => v.item.kind === 'folder' && v.item.parentUID === parentUID)
                .map((v) => v.item);
            return Promise.resolve(childrenForUID);
        },
        listDashboards(parentUID) {
            const childrenForUID = mockTree
                .filter((v) => v.item.kind === 'dashboard' && v.item.parentUID === parentUID)
                .map((v) => v.item);
            return Promise.resolve(childrenForUID);
        } });
});
describe('browse-dashboards BrowseView', () => {
    const WIDTH = 800;
    const HEIGHT = 600;
    it('expands and collapses a folder', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseView, { canSelect: true, folderUID: undefined, width: WIDTH, height: HEIGHT }));
        yield screen.findByText(folderA.item.title);
        yield expandFolder(folderA.item);
        expect(screen.queryByText(folderA_folderA.item.title)).toBeInTheDocument();
        yield collapseFolder(folderA.item);
        expect(screen.queryByText(folderA_folderA.item.title)).not.toBeInTheDocument();
    }));
    it('checks items when selected', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseView, { canSelect: true, folderUID: undefined, width: WIDTH, height: HEIGHT }));
        const checkbox = yield screen.findByTestId(selectors.pages.BrowseDashboards.table.checkbox(dashbdD.item.uid));
        expect(checkbox).not.toBeChecked();
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
    }));
    it('checks all descendants when a folder is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseView, { canSelect: true, folderUID: undefined, width: WIDTH, height: HEIGHT }));
        yield screen.findByText(folderA.item.title);
        // First expand then click folderA
        yield expandFolder(folderA.item);
        yield clickCheckbox(folderA.item);
        // All the visible items in it should be checked now
        const directChildren = mockTree.filter((v) => v.item.kind !== 'ui' && v.item.parentUID === folderA.item.uid);
        for (const child of directChildren) {
            const childCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(child.item.uid));
            expect(childCheckbox).toBeChecked();
        }
    }));
    it('checks descendants loaded after a folder is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseView, { canSelect: true, folderUID: undefined, width: WIDTH, height: HEIGHT }));
        yield screen.findByText(folderA.item.title);
        // First expand then click folderA
        yield expandFolder(folderA.item);
        yield clickCheckbox(folderA.item);
        // When additional children are loaded (by expanding a folder), those items
        // should also be selected
        yield expandFolder(folderA_folderB.item);
        const grandchildren = mockTree.filter((v) => v.item.kind !== 'ui' && v.item.parentUID === folderA_folderB.item.uid);
        for (const child of grandchildren) {
            const childCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(child.item.uid));
            expect(childCheckbox).toBeChecked();
        }
    }));
    it('unchecks ancestors when unselecting an item', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseView, { canSelect: true, folderUID: undefined, width: WIDTH, height: HEIGHT }));
        yield screen.findByText(folderA.item.title);
        yield expandFolder(folderA.item);
        yield expandFolder(folderA_folderB.item);
        yield clickCheckbox(folderA.item);
        yield clickCheckbox(folderA_folderB_dashbdB.item);
        const itemCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA_folderB_dashbdB.item.uid));
        expect(itemCheckbox).not.toBeChecked();
        const parentCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA_folderB.item.uid));
        expect(parentCheckbox).not.toBeChecked();
        const grandparentCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA.item.uid));
        expect(grandparentCheckbox).not.toBeChecked();
    }));
    it('shows indeterminate checkboxes when a descendant is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseView, { canSelect: true, folderUID: undefined, width: WIDTH, height: HEIGHT }));
        yield screen.findByText(folderA.item.title);
        yield expandFolder(folderA.item);
        yield expandFolder(folderA_folderB.item);
        yield clickCheckbox(folderA_folderB_dashbdB.item);
        const parentCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA_folderB.item.uid));
        expect(parentCheckbox).not.toBeChecked();
        expect(parentCheckbox).toBePartiallyChecked();
        const grandparentCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA.item.uid));
        expect(grandparentCheckbox).not.toBeChecked();
        expect(grandparentCheckbox).toBePartiallyChecked();
    }));
    describe('when there is no item in the folder', () => {
        it('shows a CTA for creating a dashboard if the user has editor rights', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseView, { canSelect: true, folderUID: folderB_empty.item.uid, width: WIDTH, height: HEIGHT }));
            expect(yield screen.findByText('Create Dashboard')).toBeInTheDocument();
        }));
        it('shows a simple message if the user has viewer rights', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseView, { canSelect: false, folderUID: folderB_empty.item.uid, width: WIDTH, height: HEIGHT }));
            expect(yield screen.findByText('This folder is empty')).toBeInTheDocument();
        }));
    });
});
function expandFolder(item) {
    return __awaiter(this, void 0, void 0, function* () {
        const row = screen.getByTestId(selectors.pages.BrowseDashboards.table.row(item.title));
        const expandButton = getByLabelText(row, /Expand folder/);
        yield userEvent.click(expandButton);
    });
}
function collapseFolder(item) {
    return __awaiter(this, void 0, void 0, function* () {
        const row = screen.getByTestId(selectors.pages.BrowseDashboards.table.row(item.title));
        const expandButton = getByLabelText(row, /Collapse folder/);
        yield userEvent.click(expandButton);
    });
}
function clickCheckbox(item) {
    return __awaiter(this, void 0, void 0, function* () {
        const checkbox = screen.getByTestId(selectors.pages.BrowseDashboards.table.checkbox(item.uid));
        yield userEvent.click(checkbox);
    });
}
//# sourceMappingURL=BrowseView.test.js.map