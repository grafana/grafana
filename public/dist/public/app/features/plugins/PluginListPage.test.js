import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { PluginListPage } from './PluginListPage';
import { PluginErrorCode } from '@grafana/data';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { setPluginsSearchQuery } from './state/reducers';
import { render, screen, waitFor } from '@testing-library/react';
import { selectors } from '@grafana/e2e-selectors';
import { Provider } from 'react-redux';
import { configureStore } from '../../store/configureStore';
import { afterEach } from '../../../test/lib/common';
var errorsReturnMock = [];
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    var mockedRuntime = __assign(__assign({}, original), { getBackendSrv: function () { return ({
            get: function () {
                return errorsReturnMock;
            },
        }); } });
    mockedRuntime.config.pluginAdminEnabled = false;
    return mockedRuntime;
});
var setup = function (propOverrides) {
    var store = configureStore();
    var props = {
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Plugins',
            },
        },
        plugins: [],
        searchQuery: '',
        setPluginsSearchQuery: mockToolkitActionCreator(setPluginsSearchQuery),
        loadPlugins: jest.fn(),
        hasFetched: false,
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(Provider, { store: store },
        React.createElement(PluginListPage, __assign({}, props))));
};
describe('Render', function () {
    afterEach(function () {
        errorsReturnMock = [];
    });
    it('should render component', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    errorsReturnMock = [];
                    setup();
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.queryByLabelText(selectors.pages.PluginsList.page)).toBeInTheDocument();
                            expect(screen.queryByLabelText(selectors.pages.PluginsList.list)).not.toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should render list', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    errorsReturnMock = [];
                    setup({
                        hasFetched: true,
                    });
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.queryByLabelText(selectors.pages.PluginsList.list)).toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe('Plugin signature errors', function () {
        it('should render notice if there are plugins with signing errors', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        errorsReturnMock = [{ pluginId: 'invalid-sig', errorCode: PluginErrorCode.invalidSignature }];
                        setup({
                            hasFetched: true,
                        });
                        return [4 /*yield*/, waitFor(function () {
                                return expect(screen.getByLabelText(selectors.pages.PluginsList.signatureErrorNotice)).toBeInTheDocument();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=PluginListPage.test.js.map