import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { LoadingPlaceholder } from '@grafana/ui/src';
var TestRuleResult = /** @class */ (function (_super) {
    tslib_1.__extends(TestRuleResult, _super);
    function TestRuleResult() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isLoading: false,
            testRuleResponse: {},
        };
        return _this;
    }
    TestRuleResult.prototype.componentDidMount = function () {
        this.testRule();
    };
    TestRuleResult.prototype.testRule = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, panelId, dashboard, payload, testRuleResponse;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, panelId = _a.panelId, dashboard = _a.dashboard;
                        payload = { dashboard: dashboard.getSaveModelClone(), panelId: panelId };
                        this.setState({ isLoading: true });
                        return [4 /*yield*/, getBackendSrv().post("/api/alerts/test", payload)];
                    case 1:
                        testRuleResponse = _b.sent();
                        this.setState({ isLoading: false, testRuleResponse: testRuleResponse });
                        return [2 /*return*/];
                }
            });
        });
    };
    TestRuleResult.prototype.render = function () {
        var _a = this.state, testRuleResponse = _a.testRuleResponse, isLoading = _a.isLoading;
        if (isLoading === true) {
            return React.createElement(LoadingPlaceholder, { text: "Evaluating rule" });
        }
        return React.createElement(JSONFormatter, { json: testRuleResponse });
    };
    return TestRuleResult;
}(PureComponent));
export { TestRuleResult };
//# sourceMappingURL=TestRuleResult.js.map