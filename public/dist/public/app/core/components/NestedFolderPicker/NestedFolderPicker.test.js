import { __awaiter } from "tslib";
import 'whatwg-fetch'; // fetch polyfill
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { backendSrv } from 'app/core/services/backend_srv';
import { wellFormedTree } from '../../../features/browse-dashboards/fixtures/dashboardsTreeItem.fixture';
import { NestedFolderPicker } from './NestedFolderPicker';
const [mockTree, { folderA, folderB, folderC, folderA_folderA, folderA_folderB }] = wellFormedTree();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
jest.mock('app/features/browse-dashboards/api/services', () => {
    const orig = jest.requireActual('app/features/browse-dashboards/api/services');
    return Object.assign(Object.assign({}, orig), { listFolders(parentUID) {
            const childrenForUID = mockTree
                .filter((v) => v.item.kind === 'folder' && v.item.parentUID === parentUID)
                .map((v) => v.item);
            return Promise.resolve(childrenForUID);
        } });
});
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
describe('NestedFolderPicker', () => {
    const mockOnChange = jest.fn();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    let server;
    beforeAll(() => {
        window.HTMLElement.prototype.scrollIntoView = function () { };
        server = setupServer(rest.get('/api/folders/:uid', (_, res, ctx) => {
            return res(ctx.status(200), ctx.json({
                title: folderA.item.title,
                uid: folderA.item.uid,
            }));
        }));
        server.listen();
    });
    afterAll(() => {
        server.close();
        window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    });
    afterEach(() => {
        jest.resetAllMocks();
        server.resetHandlers();
    });
    it('renders a button with the correct label when no folder is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NestedFolderPicker, { onChange: mockOnChange }));
        expect(yield screen.findByRole('button', { name: 'Select folder' })).toBeInTheDocument();
    }));
    it('renders a button with the correct label when a folder is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NestedFolderPicker, { onChange: mockOnChange, value: "folderA" }));
        expect(yield screen.findByRole('button', { name: `Select folder: ${folderA.item.title} currently selected` })).toBeInTheDocument();
    }));
    it('clicking the button opens the folder picker', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NestedFolderPicker, { onChange: mockOnChange }));
        // Open the picker and wait for children to load
        const button = yield screen.findByRole('button', { name: 'Select folder' });
        yield userEvent.click(button);
        yield screen.findByLabelText(folderA.item.title);
        // Select folder button is no longer visible
        expect(screen.queryByRole('button', { name: 'Select folder' })).not.toBeInTheDocument();
        // Search input and folder tree are visible
        expect(screen.getByPlaceholderText('Search folders')).toBeInTheDocument();
        expect(screen.getByLabelText('Dashboards')).toBeInTheDocument();
        expect(screen.getByLabelText(folderA.item.title)).toBeInTheDocument();
        expect(screen.getByLabelText(folderB.item.title)).toBeInTheDocument();
        expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument();
    }));
    it('can select a folder from the picker', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NestedFolderPicker, { onChange: mockOnChange }));
        // Open the picker and wait for children to load
        const button = yield screen.findByRole('button', { name: 'Select folder' });
        yield userEvent.click(button);
        yield screen.findByLabelText(folderA.item.title);
        yield userEvent.click(screen.getByLabelText(folderA.item.title));
        expect(mockOnChange).toHaveBeenCalledWith(folderA.item.uid, folderA.item.title);
    }));
    it('can select a folder from the picker with the keyboard', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NestedFolderPicker, { onChange: mockOnChange }));
        const button = yield screen.findByRole('button', { name: 'Select folder' });
        yield userEvent.click(button);
        yield userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
        expect(mockOnChange).toHaveBeenCalledWith(folderA.item.uid, folderA.item.title);
    }));
    it('can expand and collapse a folder to show its children', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NestedFolderPicker, { onChange: mockOnChange }));
        // Open the picker and wait for children to load
        const button = yield screen.findByRole('button', { name: 'Select folder' });
        yield userEvent.click(button);
        yield screen.findByLabelText(folderA.item.title);
        // Expand Folder A
        // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
        fireEvent.mouseDown(screen.getByRole('button', { name: `Expand folder ${folderA.item.title}` }));
        // Folder A's children are visible
        expect(yield screen.findByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
        expect(yield screen.findByLabelText(folderA_folderB.item.title)).toBeInTheDocument();
        // Collapse Folder A
        // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
        fireEvent.mouseDown(screen.getByRole('button', { name: `Collapse folder ${folderA.item.title}` }));
        expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();
        // Expand Folder A again
        // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
        fireEvent.mouseDown(screen.getByRole('button', { name: `Expand folder ${folderA.item.title}` }));
        // Select the first child
        yield userEvent.click(screen.getByLabelText(folderA_folderA.item.title));
        expect(mockOnChange).toHaveBeenCalledWith(folderA_folderA.item.uid, folderA_folderA.item.title);
    }));
    it('can expand and collapse a folder to show its children with the keyboard', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NestedFolderPicker, { onChange: mockOnChange }));
        const button = yield screen.findByRole('button', { name: 'Select folder' });
        yield userEvent.click(button);
        // Expand Folder A
        yield userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
        // Folder A's children are visible
        expect(screen.getByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
        expect(screen.getByLabelText(folderA_folderB.item.title)).toBeInTheDocument();
        // Collapse Folder A
        yield userEvent.keyboard('{ArrowLeft}');
        expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();
        // Expand Folder A again
        yield userEvent.keyboard('{ArrowRight}');
        // Select the first child
        yield userEvent.keyboard('{ArrowDown}{Enter}');
        expect(mockOnChange).toHaveBeenCalledWith(folderA_folderA.item.uid, folderA_folderA.item.title);
    }));
});
//# sourceMappingURL=NestedFolderPicker.test.js.map