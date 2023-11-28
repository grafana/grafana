import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { Input, Field, Form, Button, FieldSet, VerticalGroup } from '@grafana/ui';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { updateTeamRoles } from 'app/core/components/RolePicker/api';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { updateTeam } from './state/actions';
const mapDispatchToProps = {
    updateTeam,
};
const connector = connect(null, mapDispatchToProps);
export const TeamSettings = ({ team, updateTeam }) => {
    const canWriteTeamSettings = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsWrite, team);
    const currentOrgId = contextSrv.user.orgId;
    const [{ roleOptions }] = useRoleOptions(currentOrgId);
    const [pendingRoles, setPendingRoles] = useState([]);
    const canUpdateRoles = contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
        contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);
    const canListRoles = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRolesList, team) &&
        contextSrv.hasPermission(AccessControlAction.ActionRolesList);
    return (React.createElement(VerticalGroup, { spacing: "lg" },
        React.createElement(Form, { defaultValues: Object.assign({}, team), onSubmit: (formTeam) => __awaiter(void 0, void 0, void 0, function* () {
                if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles) {
                    yield updateTeamRoles(pendingRoles, team.id);
                }
                updateTeam(formTeam.name, formTeam.email || '');
            }), disabled: !canWriteTeamSettings }, ({ register, errors }) => (React.createElement(FieldSet, { label: "Team details" },
            React.createElement(Field, { label: "Name", disabled: !canWriteTeamSettings, required: true, invalid: !!errors.name, error: "Name is required" },
                React.createElement(Input, Object.assign({}, register('name', { required: true }), { id: "name-input" }))),
            contextSrv.licensedAccessControlEnabled() && canListRoles && (React.createElement(Field, { label: "Role" },
                React.createElement(TeamRolePicker, { teamId: team.id, roleOptions: roleOptions, disabled: !canUpdateRoles, apply: true, onApplyRoles: setPendingRoles, pendingRoles: pendingRoles, maxWidth: "100%" }))),
            React.createElement(Field, { label: "Email", description: "This is optional and is primarily used to set the team profile avatar (via gravatar service).", disabled: !canWriteTeamSettings },
                React.createElement(Input, Object.assign({}, register('email'), { placeholder: "team@email.com", type: "email", id: "email-input" }))),
            React.createElement(Button, { type: "submit", disabled: !canWriteTeamSettings }, "Update")))),
        React.createElement(SharedPreferences, { resourceUri: `teams/${team.id}`, disabled: !canWriteTeamSettings, preferenceType: "team" })));
};
export default connector(TeamSettings);
//# sourceMappingURL=TeamSettings.js.map