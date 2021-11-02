import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import OrgProfile from './OrgProfile';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { loadOrganization, updateOrganization } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { setOrganizationName } from './state/reducers';
import { VerticalGroup } from '@grafana/ui';
var OrgDetailsPage = /** @class */ (function (_super) {
    __extends(OrgDetailsPage, _super);
    function OrgDetailsPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onUpdateOrganization = function (orgName) {
            _this.props.setOrganizationName(orgName);
            _this.props.updateOrganization();
        };
        return _this;
    }
    OrgDetailsPage.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
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
        var _a = this.props, navModel = _a.navModel, organization = _a.organization;
        var isLoading = Object.keys(organization).length === 0;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading }, !isLoading && (React.createElement(VerticalGroup, { spacing: "lg" },
                React.createElement(OrgProfile, { onSubmit: this.onUpdateOrganization, orgName: organization.name }),
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
export default connect(mapStateToProps, mapDispatchToProps)(OrgDetailsPage);
//# sourceMappingURL=OrgDetailsPage.js.map