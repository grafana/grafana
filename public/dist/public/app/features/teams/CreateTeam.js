import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, Form, Field, Input, FieldSet } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { updateTeamRoles } from 'app/core/components/RolePicker/api';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
const pageNav = {
    icon: 'users-alt',
    id: 'team-new',
    text: 'New team',
    subTitle: 'Create a new team. Teams let you grant permissions to a group of users.',
};
export const CreateTeam = () => {
    const currentOrgId = contextSrv.user.orgId;
    const [pendingRoles, setPendingRoles] = useState([]);
    const [{ roleOptions }] = useRoleOptions(currentOrgId);
    const canUpdateRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
        contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);
    const createTeam = (formModel) => __awaiter(void 0, void 0, void 0, function* () {
        const newTeam = yield getBackendSrv().post('/api/teams', formModel);
        if (newTeam.teamId) {
            try {
                yield contextSrv.fetchUserPermissions();
                if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles) {
                    yield updateTeamRoles(pendingRoles, newTeam.teamId, newTeam.orgId);
                }
            }
            catch (e) {
                console.error(e);
            }
            locationService.push(`/org/teams/edit/${newTeam.teamId}`);
        }
    });
    return (React.createElement(Page, { navId: "teams", pageNav: pageNav },
        React.createElement(Page.Contents, null,
            React.createElement(Form, { onSubmit: createTeam }, ({ register, errors }) => (React.createElement(React.Fragment, null,
                React.createElement(FieldSet, null,
                    React.createElement(Field, { label: "Name", required: true, invalid: !!errors.name, error: "Team name is required" },
                        React.createElement(Input, Object.assign({}, register('name', { required: true }), { id: "team-name" }))),
                    contextSrv.licensedAccessControlEnabled() && (React.createElement(Field, { label: "Role" },
                        React.createElement(TeamRolePicker, { teamId: 0, roleOptions: roleOptions, disabled: false, apply: true, onApplyRoles: setPendingRoles, pendingRoles: pendingRoles, maxWidth: "100%" }))),
                    React.createElement(Field, { label: 'Email', description: 'This is optional and is primarily used for allowing custom team avatars.' },
                        React.createElement(Input, Object.assign({}, register('email'), { type: "email", id: "team-email", placeholder: "email@test.com" })))),
                React.createElement(Button, { type: "submit", variant: "primary" }, "Create")))))));
};
export default CreateTeam;
//# sourceMappingURL=CreateTeam.js.map