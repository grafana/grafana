import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import AnalyticsConfig from './AnalyticsConfig';
import userEvent from '@testing-library/user-event';
var setup = function (propsFunc) {
    var props = {
        options: {
            id: 21,
            uid: 'x',
            orgId: 1,
            name: 'Azure Monitor-10-10',
            type: 'grafana-azure-monitor-datasource',
            typeName: 'Azure',
            typeLogoUrl: '',
            access: 'proxy',
            url: '',
            password: '',
            user: '',
            database: '',
            basicAuth: false,
            basicAuthUser: '',
            basicAuthPassword: '',
            withCredentials: false,
            isDefault: false,
            secureJsonFields: {},
            jsonData: {
                cloudName: '',
                subscriptionId: '',
            },
            version: 1,
            readOnly: false,
        },
        updateOptions: jest.fn(),
    };
    if (propsFunc) {
        props = propsFunc(props);
    }
    return render(React.createElement(AnalyticsConfig, __assign({}, props)));
};
describe('Render', function () {
    it('should disable log analytics credentials form', function () {
        setup(function (props) { return (__assign(__assign({}, props), { options: __assign(__assign({}, props.options), { jsonData: __assign(__assign({}, props.options.jsonData), { azureLogAnalyticsSameAs: true }) }) })); });
        expect(screen.queryByText('Azure Monitor Logs')).not.toBeInTheDocument();
    });
    it('should not render the Switch to use different creds for log analytics by default', function () {
        setup();
        expect(screen.queryByText('is no longer supported', { exact: false })).not.toBeInTheDocument();
    });
    // Remove this test with deprecated code
    it('should not render the Switch if different creds for log analytics were set from before', function () {
        setup(function (props) { return (__assign(__assign({}, props), { options: __assign(__assign({}, props.options), { jsonData: __assign(__assign({}, props.options.jsonData), { azureLogAnalyticsSameAs: false }) }) })); });
        expect(screen.queryByText('is no longer supported', { exact: false })).toBeInTheDocument();
    });
    it('should clean up the error when resetting the credentials', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onUpdate, newOpts;
        return __generator(this, function (_a) {
            onUpdate = jest.fn();
            setup(function (props) { return (__assign(__assign({}, props), { options: __assign(__assign({}, props.options), { jsonData: __assign(__assign({}, props.options.jsonData), { azureLogAnalyticsSameAs: false }) }), updateOptions: onUpdate })); });
            expect(screen.queryByText('is no longer supported', { exact: false })).toBeInTheDocument();
            userEvent.click(screen.getByText('Clear Azure Monitor Logs Credentials'));
            expect(onUpdate).toHaveBeenCalled();
            newOpts = onUpdate.mock.calls[0][0]({});
            expect(newOpts).toEqual({ jsonData: { azureLogAnalyticsSameAs: true } });
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=AnalyticsConfig.test.js.map