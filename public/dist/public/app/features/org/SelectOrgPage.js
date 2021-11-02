import { __awaiter, __generator, __read } from "tslib";
import React, { useState } from 'react';
import Page from 'app/core/components/Page/Page';
import { getBackendSrv, config } from '@grafana/runtime';
import { useAsync } from 'react-use';
import { Button, HorizontalGroup } from '@grafana/ui';
var navModel = {
    main: {
        icon: 'grafana',
        subTitle: 'Preferences',
        text: 'Select active organization',
    },
    node: {
        text: 'Select active organization',
    },
};
var getUserOrgs = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv().get('/api/user/orgs')];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var setUserOrg = function (org) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv()
                    .post('/api/user/using/' + org.orgId)
                    .then(function () {
                    window.location.href = config.appSubUrl + '/';
                })];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
export var SelectOrgPage = function () {
    var _a = __read(useState(), 2), orgs = _a[0], setOrgs = _a[1];
    useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setOrgs;
                    return [4 /*yield*/, getUserOrgs()];
                case 1:
                    _a.apply(void 0, [_b.sent()]);
                    return [2 /*return*/];
            }
        });
    }); }, []);
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("div", null,
                React.createElement("p", null, "You have been invited to another organization! Please select which organization that you want to use right now. You can change this later at any time."),
                React.createElement(HorizontalGroup, { wrap: true }, orgs &&
                    orgs.map(function (org) { return (React.createElement(Button, { key: org.orgId, icon: "signin", onClick: function () { return setUserOrg(org); } }, org.name)); }))))));
};
export default SelectOrgPage;
//# sourceMappingURL=SelectOrgPage.js.map