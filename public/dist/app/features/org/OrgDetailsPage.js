import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import OrgProfile from './OrgProfile';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { loadOrganization, setOrganizationName, updateOrganization } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
var OrgDetailsPage = /** @class */ (function (_super) {
    tslib_1.__extends(OrgDetailsPage, _super);
    function OrgDetailsPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onOrgNameChange = function (name) {
            _this.props.setOrganizationName(name);
        };
        _this.onUpdateOrganization = function () {
            _this.props.updateOrganization();
        };
        return _this;
    }
    OrgDetailsPage.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadOrganization()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    OrgDetailsPage.prototype.render = function () {
        var _this = this;
        var _a = this.props, navModel = _a.navModel, organization = _a.organization;
        var isLoading = Object.keys(organization).length === 0;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading }, !isLoading && (React.createElement("div", null,
                React.createElement(OrgProfile, { onOrgNameChange: function (name) { return _this.onOrgNameChange(name); }, onSubmit: this.onUpdateOrganization, orgName: organization.name }),
                React.createElement(SharedPreferences, { resourceUri: "org" }))))));
    };
    return OrgDetailsPage;
}(PureComponent));
export { OrgDetailsPage };
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'org-settings'),
        organization: state.organization.organization,
    };
}
var mapDispatchToProps = {
    loadOrganization: loadOrganization,
    setOrganizationName: setOrganizationName,
    updateOrganization: updateOrganization,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(OrgDetailsPage));
//# sourceMappingURL=OrgDetailsPage.js.map