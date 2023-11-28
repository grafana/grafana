import { __awaiter } from "tslib";
import { findByText, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PluginType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ModalRoot, ModalsProvider } from '@grafana/ui';
import config from 'app/core/config';
import { defaultFileUploadQuery } from 'app/plugins/datasource/grafana/types';
import { DataSourceDropdown } from './DataSourceDropdown';
import * as utils from './utils';
const pluginMetaInfo = {
    author: { name: '' },
    description: '',
    screenshots: [],
    version: '',
    updated: '',
    links: [],
    logos: { small: '', large: '' },
};
function createPluginMeta(name, builtIn) {
    return { builtIn, name, id: name, type: PluginType.datasource, baseUrl: '', info: pluginMetaInfo, module: '' };
}
function createDS(name, id, builtIn) {
    return {
        name: name,
        uid: name + 'uid',
        meta: createPluginMeta(name, builtIn),
        id,
        access: 'direct',
        jsonData: {},
        type: '',
        readOnly: true,
    };
}
const mockDS1 = createDS('mock.datasource.1', 1, false);
const mockDS2 = createDS('mock.datasource.2', 2, false);
const MockDSBuiltIn = createDS('mock.datasource.builtin', 3, true);
const mockDSList = [mockDS1, mockDS2, MockDSBuiltIn];
function setupOpenDropdown(user, props) {
    return __awaiter(this, void 0, void 0, function* () {
        const dropdown = render(React.createElement(DataSourceDropdown, Object.assign({}, props)));
        const searchBox = dropdown.container.querySelector('input');
        expect(searchBox).toBeInTheDocument();
        yield user.click(searchBox);
    });
}
jest.mock('@grafana/runtime', () => {
    const actual = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, actual), { getTemplateSrv: () => {
            return {
                getVariables: () => [{ id: 'foo', type: 'datasource' }],
            };
        } });
});
jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
    return {
        getDataSourceSrv: () => ({
            getList: getListMock,
            getInstanceSettings: getInstanceSettingsMock,
        }),
    };
});
const pushRecentlyUsedDataSourceMock = jest.fn();
jest.mock('../../hooks', () => {
    const actual = jest.requireActual('../../hooks');
    return Object.assign(Object.assign({}, actual), { useRecentlyUsedDataSources: () => [[mockDS2.name], pushRecentlyUsedDataSourceMock] });
});
beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
});
const getListMock = jest.fn();
const getInstanceSettingsMock = jest.fn();
beforeEach(() => {
    getListMock.mockReturnValue(mockDSList);
    getInstanceSettingsMock.mockReturnValue(mockDS1);
});
describe('DataSourceDropdown', () => {
    it('should render', () => {
        expect(() => render(React.createElement(DataSourceDropdown, { onChange: jest.fn() }))).not.toThrow();
    });
    describe('configuration', () => {
        const user = userEvent.setup();
        it('should fetch the DS applying the correct filters consistently across lists', () => __awaiter(void 0, void 0, void 0, function* () {
            const filters = {
                mixed: true,
                tracing: true,
                dashboard: true,
                metrics: true,
                type: 'foo',
                annotations: true,
                variables: true,
                alerting: true,
                pluginId: 'pluginid',
                logs: true,
            };
            const props = Object.assign({ onChange: () => { }, current: mockDS1.name }, filters);
            render(React.createElement(ModalsProvider, null,
                React.createElement(DataSourceDropdown, Object.assign({}, props)),
                React.createElement(ModalRoot, null)));
            const searchBox = yield screen.findByRole('textbox');
            expect(searchBox).toBeInTheDocument();
            getListMock.mockClear();
            yield user.click(searchBox);
            yield user.click(yield screen.findByText('Open advanced data source picker'));
            expect(yield screen.findByText('Select data source')); //Data source modal is open
            // Every call to the service must contain same filters
            getListMock.mock.calls.forEach((call) => expect(call[0]).toMatchObject(Object.assign({}, filters)));
        }));
        it('should display the current selected DS in the selector', () => __awaiter(void 0, void 0, void 0, function* () {
            getInstanceSettingsMock.mockReturnValue(mockDS2);
            render(React.createElement(DataSourceDropdown, { onChange: jest.fn(), current: mockDS2 }));
            expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toHaveAttribute('placeholder', mockDS2.name);
            expect(screen.getByAltText(`${mockDS2.meta.name} logo`)).toBeVisible();
        }));
        it('should display the current ds on top', () => __awaiter(void 0, void 0, void 0, function* () {
            //Mock ds is set as current, it appears on top
            getInstanceSettingsMock.mockReturnValue(mockDS1);
            yield setupOpenDropdown(user, { onChange: jest.fn(), current: mockDS1.name });
            let cards = yield screen.findAllByTestId('data-source-card');
            expect(yield findByText(cards[0], mockDS1.name, { selector: 'span' })).toBeInTheDocument();
            //xMock ds is set as current, it appears on top
            getInstanceSettingsMock.mockReturnValue(mockDS2);
            yield setupOpenDropdown(user, { onChange: jest.fn(), current: mockDS2.name });
            cards = yield screen.findAllByTestId('data-source-card');
            expect(yield findByText(cards[0], mockDS2.name, { selector: 'span' })).toBeInTheDocument();
        }));
        it('should display the default DS as selected when `current` is not set', () => __awaiter(void 0, void 0, void 0, function* () {
            getInstanceSettingsMock.mockReturnValue(mockDS2);
            render(React.createElement(DataSourceDropdown, { onChange: jest.fn(), current: undefined }));
            expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toHaveAttribute('placeholder', mockDS2.name);
            expect(screen.getByAltText(`${mockDS2.meta.name} logo`)).toBeVisible();
        }));
        it('should get the sorting function using the correct parameters', () => __awaiter(void 0, void 0, void 0, function* () {
            //The actual sorting is tested in utils.test but let's make sure we're calling getDataSourceCompareFn with the correct parameters
            const spy = jest.spyOn(utils, 'getDataSourceCompareFn');
            yield setupOpenDropdown(user, { onChange: jest.fn(), current: mockDS1 });
            expect(spy.mock.lastCall).toEqual([mockDS1, [mockDS2.name], ['${foo}']]);
        }));
        it('should disable the dropdown when `disabled` is true', () => {
            render(React.createElement(DataSourceDropdown, { onChange: jest.fn(), disabled: true }));
            expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toBeDisabled();
        });
        it('should assign the correct `id` to the input element to pair it with a label', () => {
            render(React.createElement(DataSourceDropdown, { onChange: jest.fn(), inputId: 'custom.input.id' }));
            expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toHaveAttribute('id', 'custom.input.id');
        });
        it('should not set the default DS when setting `noDefault` to true and `current` is not provided', () => {
            render(React.createElement(DataSourceDropdown, { onChange: jest.fn(), current: null, noDefault: true }));
            getListMock.mockClear();
            getInstanceSettingsMock.mockClear();
            // Doesn't try to get the default DS
            expect(getListMock).not.toBeCalled();
            expect(getInstanceSettingsMock).not.toBeCalled();
            expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toHaveAttribute('placeholder', 'Select data source');
        });
    });
    describe('interactions', () => {
        const user = userEvent.setup();
        it('should open when clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupOpenDropdown(user, { onChange: jest.fn() });
            expect(yield screen.findByText(mockDS1.name, { selector: 'span' })).toBeInTheDocument();
        }));
        it('should call onChange when a data source is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            yield setupOpenDropdown(user, { onChange });
            yield user.click(yield screen.findByText(mockDS2.name, { selector: 'span' }));
            expect(onChange.mock.lastCall[0]['name']).toEqual(mockDS2.name);
            expect(screen.queryByText(mockDS1.name, { selector: 'span' })).toBeNull();
        }));
        it('should not call onChange when the currently selected data source is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            yield setupOpenDropdown(user, { onChange });
            yield user.click(yield screen.findByText(mockDS1.name, { selector: 'span' }));
            expect(onChange).not.toBeCalled();
        }));
        it('should push recently used datasources when a data source is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            yield setupOpenDropdown(user, { onChange });
            yield user.click(yield screen.findByText(mockDS2.name, { selector: 'span' }));
            expect(pushRecentlyUsedDataSourceMock.mock.lastCall[0]).toEqual(mockDS2);
        }));
        it('should be navigatable by keyboard', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            yield setupOpenDropdown(user, { onChange });
            yield user.keyboard('[ArrowDown]');
            //Arrow down, second item is selected
            const xMockDSElement = getCard(yield screen.findByText(mockDS2.name, { selector: 'span' }));
            expect(xMockDSElement === null || xMockDSElement === void 0 ? void 0 : xMockDSElement.dataset.selecteditem).toEqual('true');
            let mockDSElement = getCard(yield screen.findByText(mockDS1.name, { selector: 'span' }));
            expect(mockDSElement === null || mockDSElement === void 0 ? void 0 : mockDSElement.dataset.selecteditem).toEqual('false');
            yield user.keyboard('[ArrowUp]');
            //Arrow up, first item is selected again
            mockDSElement = getCard(yield screen.findByText(mockDS1.name, { selector: 'span' }));
            expect(mockDSElement === null || mockDSElement === void 0 ? void 0 : mockDSElement.dataset.selecteditem).toEqual('true');
            yield user.keyboard('[ArrowDown]');
            yield user.keyboard('[Enter]');
            //Arrow down to navigate to xMock, enter to select it. Assert onChange called with correct DS and dropdown closed.
            expect(onChange.mock.lastCall[0]['name']).toEqual(mockDS2.name);
            expect(screen.queryByText(mockDS1.name, { selector: 'span' })).toBeNull();
        }));
        it('should be searchable', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupOpenDropdown(user, { onChange: jest.fn() });
            yield user.keyboard(mockDS2.name); //Search for xMockDS
            expect(screen.queryByText(mockDS1.name, { selector: 'span' })).toBeNull();
            const xMockCard = getCard(yield screen.findByText(mockDS2.name, { selector: 'span' }));
            expect(xMockCard).toBeInTheDocument();
            expect(xMockCard === null || xMockCard === void 0 ? void 0 : xMockCard.dataset.selecteditem).toEqual('true'); //The first search result is selected
            yield user.keyboard('foobarbaz'); //Search for a DS that should not exist
            expect(yield screen.findByText('Configure a new data source')).toBeInTheDocument();
        }));
        it('should call onChange with the default query when add csv is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.editPanelCSVDragAndDrop = true;
            const onChange = jest.fn();
            yield setupOpenDropdown(user, { onChange, uploadFile: true });
            yield user.click(yield screen.findByText('Add csv or spreadsheet'));
            expect(onChange.mock.lastCall[1]).toEqual([defaultFileUploadQuery]);
            expect(screen.queryByText('Open advanced data source picker')).toBeNull(); //Drop down is closed
            config.featureToggles.editPanelCSVDragAndDrop = false;
        }));
        it('should open the modal when open advanced is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            const props = { onChange: jest.fn(), current: mockDS1.name };
            render(React.createElement(ModalsProvider, null,
                React.createElement(DataSourceDropdown, Object.assign({}, props)),
                React.createElement(ModalRoot, null)));
            const searchBox = yield screen.findByRole('textbox');
            expect(searchBox).toBeInTheDocument();
            yield user.click(searchBox);
            yield user.click(yield screen.findByText('Open advanced data source picker'));
            expect(yield screen.findByText('Select data source')); //Data source modal is open
            expect(screen.queryByText('Open advanced data source picker')).toBeNull(); //Drop down is closed
        }));
    });
});
function getCard(element) {
    var _a, _b, _c;
    return (_c = (_b = (_a = element.parentElement) === null || _a === void 0 ? void 0 : _a.parentElement) === null || _b === void 0 ? void 0 : _b.parentElement) === null || _c === void 0 ? void 0 : _c.parentElement;
}
//# sourceMappingURL=DataSourceDropdown.test.js.map