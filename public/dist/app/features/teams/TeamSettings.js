import * as tslib_1 from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { FormLabel } from '@grafana/ui';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { updateTeam } from './state/actions';
import { getRouteParamsId } from 'app/core/selectors/location';
import { getTeam } from './state/selectors';
var TeamSettings = /** @class */ (function (_super) {
    tslib_1.__extends(TeamSettings, _super);
    function TeamSettings(props) {
        var _this = _super.call(this, props) || this;
        _this.onChangeName = function (event) {
            _this.setState({ name: event.target.value });
        };
        _this.onChangeEmail = function (event) {
            _this.setState({ email: event.target.value });
        };
        _this.onUpdate = function (event) {
            var _a = _this.state, name = _a.name, email = _a.email;
            event.preventDefault();
            _this.props.updateTeam(name, email);
        };
        _this.state = {
            name: props.team.name,
            email: props.team.email,
        };
        return _this;
    }
    TeamSettings.prototype.render = function () {
        var team = this.props.team;
        var _a = this.state, name = _a.name, email = _a.email;
        return (React.createElement("div", null,
            React.createElement("h3", { className: "page-sub-heading" }, "Team Settings"),
            React.createElement("form", { name: "teamDetailsForm", className: "gf-form-group", onSubmit: this.onUpdate },
                React.createElement("div", { className: "gf-form max-width-30" },
                    React.createElement(FormLabel, null, "Name"),
                    React.createElement("input", { type: "text", required: true, value: name, className: "gf-form-input max-width-22", onChange: this.onChangeName })),
                React.createElement("div", { className: "gf-form max-width-30" },
                    React.createElement(FormLabel, { tooltip: "This is optional and is primarily used to set the team profile avatar (via gravatar service)" }, "Email"),
                    React.createElement("input", { type: "email", className: "gf-form-input max-width-22", value: email, placeholder: "team@email.com", onChange: this.onChangeEmail })),
                React.createElement("div", { className: "gf-form-button-row" },
                    React.createElement("button", { type: "submit", className: "btn btn-primary" }, "Update"))),
            React.createElement(SharedPreferences, { resourceUri: "teams/" + team.id })));
    };
    return TeamSettings;
}(React.Component));
export { TeamSettings };
function mapStateToProps(state) {
    var teamId = getRouteParamsId(state.location);
    return {
        team: getTeam(state.team, teamId),
    };
}
var mapDispatchToProps = {
    updateTeam: updateTeam,
};
export default connect(mapStateToProps, mapDispatchToProps)(TeamSettings);
//# sourceMappingURL=TeamSettings.js.map