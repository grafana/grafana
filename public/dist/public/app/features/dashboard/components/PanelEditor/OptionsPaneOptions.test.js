import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LoadingState, standardEditorsRegistry, standardFieldConfigEditorRegistry, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { OptionsPaneOptions } from './OptionsPaneOptions';
import { DashboardModel, PanelModel } from '../../state';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';
import { getStandardFieldConfigs, getStandardOptionEditors } from '@grafana/ui';
standardEditorsRegistry.setInit(getStandardOptionEditors);
standardFieldConfigEditorRegistry.setInit(getStandardFieldConfigs);
var mockStore = configureMockStore();
var OptionsPaneSelector = selectors.components.PanelEditor.OptionsPane;
jest.mock('react-router-dom', function () { return (__assign(__assign({}, jest.requireActual('react-router-dom')), { useLocation: function () { return ({
        pathname: 'localhost:3000/example/path',
    }); } })); });
var OptionsPaneOptionsTestScenario = /** @class */ (function () {
    function OptionsPaneOptionsTestScenario() {
        this.onFieldConfigsChange = jest.fn();
        this.onPanelOptionsChanged = jest.fn();
        this.onPanelConfigChange = jest.fn();
        this.panelData = {
            series: [],
            state: LoadingState.Done,
            timeRange: {},
        };
        this.plugin = getPanelPlugin({
            id: 'TestPanel',
        }).useFieldConfig({
            standardOptions: {},
            useCustomConfig: function (b) {
                b.addBooleanSwitch({
                    name: 'CustomBool',
                    path: 'CustomBool',
                })
                    .addBooleanSwitch({
                    name: 'HiddenFromDef',
                    path: 'HiddenFromDef',
                    hideFromDefaults: true,
                })
                    .addTextInput({
                    name: 'TextPropWithCategory',
                    path: 'TextPropWithCategory',
                    settings: {
                        placeholder: 'CustomTextPropPlaceholder',
                    },
                    category: ['Axis'],
                });
            },
        });
        this.panel = new PanelModel({
            title: 'Test title',
            type: this.plugin.meta.id,
            fieldConfig: {
                defaults: {
                    max: 100,
                    thresholds: {
                        mode: 'absolute',
                        steps: [
                            { value: -Infinity, color: 'green' },
                            { value: 100, color: 'green' },
                        ],
                    },
                },
                overrides: [],
            },
            options: {},
        });
        this.dashboard = new DashboardModel({});
        this.store = mockStore({
            dashboard: { panels: [] },
            templating: {
                variables: {},
            },
        });
    }
    OptionsPaneOptionsTestScenario.prototype.render = function () {
        render(React.createElement(Provider, { store: this.store },
            React.createElement(OptionsPaneOptions, { data: this.panelData, plugin: this.plugin, panel: this.panel, dashboard: this.dashboard, onFieldConfigsChange: this.onFieldConfigsChange, onPanelConfigChange: this.onPanelConfigChange, onPanelOptionsChanged: this.onPanelOptionsChanged, instanceState: undefined })));
    };
    return OptionsPaneOptionsTestScenario;
}());
describe('OptionsPaneOptions', function () {
    it('should render panel frame options', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scenario;
        return __generator(this, function (_a) {
            scenario = new OptionsPaneOptionsTestScenario();
            scenario.render();
            expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('Panel options Title'))).toBeInTheDocument();
            return [2 /*return*/];
        });
    }); });
    it('should render all categories', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scenario;
        return __generator(this, function (_a) {
            scenario = new OptionsPaneOptionsTestScenario();
            scenario.render();
            expect(screen.getByRole('heading', { name: /Panel options/ })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: /Standard options/ })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: /Thresholds/ })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: /TestPanel/ })).toBeInTheDocument();
            return [2 /*return*/];
        });
    }); });
    it('should render custom  options', function () {
        var scenario = new OptionsPaneOptionsTestScenario();
        scenario.render();
        expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('TestPanel CustomBool'))).toBeInTheDocument();
    });
    it('should not render options that are marked as hidden from defaults', function () {
        var scenario = new OptionsPaneOptionsTestScenario();
        scenario.render();
        expect(screen.queryByLabelText(OptionsPaneSelector.fieldLabel('TestPanel HiddenFromDef'))).not.toBeInTheDocument();
    });
    it('should create categories for field options with category', function () {
        var scenario = new OptionsPaneOptionsTestScenario();
        scenario.render();
        expect(screen.getByRole('heading', { name: /Axis/ })).toBeInTheDocument();
    });
    it('should not render categories with hidden fields only', function () {
        var scenario = new OptionsPaneOptionsTestScenario();
        scenario.plugin = getPanelPlugin({
            id: 'TestPanel',
        }).useFieldConfig({
            standardOptions: {},
            useCustomConfig: function (b) {
                b.addBooleanSwitch({
                    name: 'CustomBool',
                    path: 'CustomBool',
                    hideFromDefaults: true,
                    category: ['Axis'],
                });
            },
        });
        scenario.render();
        expect(screen.queryByRole('heading', { name: /Axis/ })).not.toBeInTheDocument();
    });
    it('should call onPanelConfigChange when updating title', function () {
        var scenario = new OptionsPaneOptionsTestScenario();
        scenario.render();
        var input = screen.getByDisplayValue(scenario.panel.title);
        fireEvent.change(input, { target: { value: 'New' } });
        fireEvent.blur(input);
        expect(scenario.onPanelConfigChange).toHaveBeenCalledWith('title', 'New');
    });
    it('should call onFieldConfigsChange when updating field config', function () {
        var scenario = new OptionsPaneOptionsTestScenario();
        scenario.render();
        var input = screen.getByPlaceholderText('CustomTextPropPlaceholder');
        fireEvent.change(input, { target: { value: 'New' } });
        fireEvent.blur(input);
        var newFieldConfig = scenario.panel.fieldConfig;
        newFieldConfig.defaults.custom = { TextPropWithCategory: 'New' };
        expect(scenario.onFieldConfigsChange).toHaveBeenCalledWith(newFieldConfig);
    });
    it('should only render hits when search query specified', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scenario, input;
        return __generator(this, function (_a) {
            scenario = new OptionsPaneOptionsTestScenario();
            scenario.render();
            input = screen.getByPlaceholderText('Search options');
            fireEvent.change(input, { target: { value: 'TextPropWithCategory' } });
            fireEvent.blur(input);
            expect(screen.queryByLabelText(OptionsPaneSelector.fieldLabel('Panel options Title'))).not.toBeInTheDocument();
            expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('Axis TextPropWithCategory'))).toBeInTheDocument();
            return [2 /*return*/];
        });
    }); });
    it('should not render field override options non data panel', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scenario;
        return __generator(this, function (_a) {
            scenario = new OptionsPaneOptionsTestScenario();
            scenario.plugin = getPanelPlugin({
                id: 'TestPanel',
            });
            scenario.render();
            expect(screen.queryByLabelText(selectors.components.ValuePicker.button('Add field override'))).not.toBeInTheDocument();
            return [2 /*return*/];
        });
    }); });
    it('should allow standard properties extension', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scenario, thresholdsSection;
        return __generator(this, function (_a) {
            scenario = new OptionsPaneOptionsTestScenario();
            scenario.plugin = getPanelPlugin({
                id: 'TestPanel',
            }).useFieldConfig({
                useCustomConfig: function (b) {
                    b.addBooleanSwitch({
                        name: 'CustomThresholdOption',
                        path: 'CustomThresholdOption',
                        category: ['Thresholds'],
                    });
                },
            });
            scenario.render();
            thresholdsSection = screen.getByLabelText(selectors.components.OptionsGroup.group('Thresholds'));
            expect(within(thresholdsSection).getByLabelText(OptionsPaneSelector.fieldLabel('Thresholds CustomThresholdOption'))).toBeInTheDocument();
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=OptionsPaneOptions.test.js.map