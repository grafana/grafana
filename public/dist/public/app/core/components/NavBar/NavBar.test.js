import { __awaiter, __generator } from "tslib";
import React from 'react';
import { NavBar } from './NavBar';
import { render, screen } from '@testing-library/react';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        sidemenu: true,
        user: {},
        isSignedIn: false,
        isGrafanaAdmin: false,
        isEditor: false,
        hasEditPermissionFolders: false,
    },
}); });
var setup = function () {
    var store = configureStore();
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(NavBar, null))));
};
describe('Render', function () {
    it('should render component', function () { return __awaiter(void 0, void 0, void 0, function () {
        var sidemenu;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup();
                    return [4 /*yield*/, screen.findByTestId('sidemenu')];
                case 1:
                    sidemenu = _a.sent();
                    expect(sidemenu).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should not render when in kiosk mode', function () { return __awaiter(void 0, void 0, void 0, function () {
        var sidemenu;
        return __generator(this, function (_a) {
            setup();
            locationService.partial({ kiosk: 'full' });
            sidemenu = screen.queryByTestId('sidemenu');
            expect(sidemenu).not.toBeInTheDocument();
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=NavBar.test.js.map