import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { AsyncSelect } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
var OrgPicker = /** @class */ (function (_super) {
    __extends(OrgPicker, _super);
    function OrgPicker() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.orgs = [];
        _this.state = {
            isLoading: false,
        };
        _this.getOrgOptions = function (query) { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!((_a = this.orgs) === null || _a === void 0 ? void 0 : _a.length)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.loadOrgs()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/, this.orgs.map(function (org) { return ({
                            value: { id: org.id, name: org.name },
                            label: org.name,
                        }); })];
                }
            });
        }); };
        return _this;
    }
    OrgPicker.prototype.loadOrgs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var orgs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.setState({ isLoading: true });
                        return [4 /*yield*/, getBackendSrv().get('/api/orgs')];
                    case 1:
                        orgs = _a.sent();
                        this.orgs = orgs;
                        this.setState({ isLoading: false });
                        return [2 /*return*/, orgs];
                }
            });
        });
    };
    OrgPicker.prototype.render = function () {
        var _a = this.props, className = _a.className, onSelected = _a.onSelected;
        var isLoading = this.state.isLoading;
        return (React.createElement(AsyncSelect, { menuShouldPortal: true, className: className, isLoading: isLoading, defaultOptions: true, isSearchable: false, loadOptions: this.getOrgOptions, onChange: onSelected, placeholder: "Select organization", noOptionsMessage: "No organizations found" }));
    };
    return OrgPicker;
}(PureComponent));
export { OrgPicker };
//# sourceMappingURL=OrgPicker.js.map