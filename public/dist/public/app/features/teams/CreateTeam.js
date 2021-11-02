import { __assign, __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import Page from 'app/core/components/Page/Page';
import { Button, Form, Field, Input, FieldSet, Label, Tooltip, Icon } from '@grafana/ui';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { connect } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
var CreateTeam = /** @class */ (function (_super) {
    __extends(CreateTeam, _super);
    function CreateTeam() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.create = function (formModel) { return __awaiter(_this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBackendSrv().post('/api/teams', formModel)];
                    case 1:
                        result = _a.sent();
                        if (result.teamId) {
                            locationService.push("/org/teams/edit/" + result.teamId);
                        }
                        return [2 /*return*/];
                }
            });
        }); };
        return _this;
    }
    CreateTeam.prototype.render = function () {
        var navModel = this.props.navModel;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, null,
                React.createElement(Form, { onSubmit: this.create }, function (_a) {
                    var register = _a.register;
                    return (React.createElement(FieldSet, { label: "New Team" },
                        React.createElement(Field, { label: "Name" },
                            React.createElement(Input, __assign({}, register('name', { required: true }), { id: "team-name", width: 60 }))),
                        React.createElement(Field, { label: React.createElement(Label, null,
                                React.createElement("span", null, "Email"),
                                React.createElement(Tooltip, { content: "This is optional and is primarily used for allowing custom team avatars." },
                                    React.createElement(Icon, { name: "info-circle", style: { marginLeft: 6 } }))) },
                            React.createElement(Input, __assign({}, register('email'), { type: "email", placeholder: "email@test.com", width: 60 }))),
                        React.createElement("div", { className: "gf-form-button-row" },
                            React.createElement(Button, { type: "submit", variant: "primary" }, "Create"))));
                }))));
    };
    return CreateTeam;
}(PureComponent));
export { CreateTeam };
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'teams'),
    };
}
export default connect(mapStateToProps)(CreateTeam);
//# sourceMappingURL=CreateTeam.js.map