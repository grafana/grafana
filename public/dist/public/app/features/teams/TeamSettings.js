import { __assign } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { Input, Field, Form, Button, FieldSet, VerticalGroup } from '@grafana/ui';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { updateTeam } from './state/actions';
var mapDispatchToProps = {
    updateTeam: updateTeam,
};
var connector = connect(null, mapDispatchToProps);
export var TeamSettings = function (_a) {
    var team = _a.team, updateTeam = _a.updateTeam;
    return (React.createElement(VerticalGroup, null,
        React.createElement(FieldSet, { label: "Team settings" },
            React.createElement(Form, { defaultValues: __assign({}, team), onSubmit: function (formTeam) {
                    updateTeam(formTeam.name, formTeam.email);
                } }, function (_a) {
                var register = _a.register;
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "Name" },
                        React.createElement(Input, __assign({}, register('name', { required: true }), { id: "name-input" }))),
                    React.createElement(Field, { label: "Email", description: "This is optional and is primarily used to set the team profile avatar (via gravatar service)." },
                        React.createElement(Input, __assign({}, register('email'), { placeholder: "team@email.com", type: "email", id: "email-input" }))),
                    React.createElement(Button, { type: "submit" }, "Update")));
            })),
        React.createElement(SharedPreferences, { resourceUri: "teams/" + team.id })));
};
export default connector(TeamSettings);
//# sourceMappingURL=TeamSettings.js.map