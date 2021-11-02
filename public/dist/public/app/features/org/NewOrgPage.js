import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { getBackendSrv } from '@grafana/runtime';
import Page from 'app/core/components/Page/Page';
import { Button, Input, Field, Form } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { connect } from 'react-redux';
import { getNavModel } from '../../core/selectors/navModel';
var createOrg = function (newOrg) { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv().post('/api/orgs/', newOrg)];
            case 1:
                result = _a.sent();
                return [4 /*yield*/, getBackendSrv().post('/api/user/using/' + result.orgId)];
            case 2:
                _a.sent();
                window.location.href = getConfig().appSubUrl + '/org';
                return [2 /*return*/];
        }
    });
}); };
var validateOrg = function (orgName) { return __awaiter(void 0, void 0, void 0, function () {
    var error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, getBackendSrv().get("api/orgs/name/" + encodeURI(orgName))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                if (error_1.status === 404) {
                    error_1.isHandled = true;
                    return [2 /*return*/, true];
                }
                return [2 /*return*/, 'Something went wrong'];
            case 3: return [2 /*return*/, 'Organization already exists'];
        }
    });
}); };
export var NewOrgPage = function (_a) {
    var navModel = _a.navModel;
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("h3", { className: "page-sub-heading" }, "New organization"),
            React.createElement("p", { className: "playlist-description" },
                "Each organization contains their own dashboards, data sources, and configuration, which cannot be shared shared between organizations. While users might belong to more than one organization, multiple organizations are most frequently used in multi-tenant deployments.",
                ' '),
            React.createElement(Form, { onSubmit: createOrg }, function (_a) {
                var register = _a.register, errors = _a.errors;
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "Organization name", invalid: !!errors.name, error: errors.name && errors.name.message },
                        React.createElement(Input, __assign({ placeholder: "Org name" }, register('name', {
                            required: 'Organization name is required',
                            validate: function (orgName) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, validateOrg(orgName)];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            }); }); },
                        })))),
                    React.createElement(Button, { type: "submit" }, "Create")));
            }))));
};
var mapStateToProps = function (state) {
    return { navModel: getNavModel(state.navIndex, 'global-orgs') };
};
export default connect(mapStateToProps)(NewOrgPage);
//# sourceMappingURL=NewOrgPage.js.map