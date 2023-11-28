import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { Component } from 'react';
import { Button, Form, HorizontalGroup, Select, stylesFactory } from '@grafana/ui';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import config from 'app/core/config';
import { dashboardPermissionLevels, dashboardAclTargets, AclTarget, PermissionLevel, OrgRole, } from 'app/types/acl';
import { CloseButton } from '../CloseButton/CloseButton';
class AddPermissions extends Component {
    constructor(props) {
        super(props);
        this.onTypeChanged = (item) => {
            const type = item.value;
            switch (type) {
                case AclTarget.User:
                case AclTarget.Team:
                    this.setState({ type: type, userId: 0, teamId: 0, role: undefined });
                    break;
                case AclTarget.Editor:
                    this.setState({ type: type, userId: 0, teamId: 0, role: OrgRole.Editor });
                    break;
                case AclTarget.Viewer:
                    this.setState({ type: type, userId: 0, teamId: 0, role: OrgRole.Viewer });
                    break;
            }
        };
        this.onUserSelected = (user) => {
            this.setState({ userId: user && !Array.isArray(user) ? user.id : 0 });
        };
        this.onTeamSelected = (team) => {
            var _a;
            this.setState({ teamId: ((_a = team.value) === null || _a === void 0 ? void 0 : _a.id) && !Array.isArray(team.value) ? team.value.id : 0 });
        };
        this.onPermissionChanged = (permission) => {
            this.setState({ permission: permission.value });
        };
        this.onSubmit = () => __awaiter(this, void 0, void 0, function* () {
            yield this.props.onAddPermission(this.state);
            this.setState(this.getCleanState());
        });
        this.state = this.getCleanState();
    }
    getCleanState() {
        return {
            userId: 0,
            teamId: 0,
            role: undefined,
            type: AclTarget.Team,
            permission: PermissionLevel.View,
        };
    }
    isValid() {
        switch (this.state.type) {
            case AclTarget.Team:
                return this.state.teamId > 0;
            case AclTarget.User:
                return this.state.userId > 0;
        }
        return true;
    }
    render() {
        const { onCancel } = this.props;
        const newItem = this.state;
        const pickerClassName = 'min-width-20';
        const isValid = this.isValid();
        const styles = getStyles(config.theme2);
        return (React.createElement("div", { className: "cta-form" },
            React.createElement(CloseButton, { onClick: onCancel }),
            React.createElement("h5", null, "Add Permission For"),
            React.createElement(Form, { maxWidth: "none", onSubmit: this.onSubmit }, () => (React.createElement(HorizontalGroup, null,
                React.createElement(Select, { "aria-label": "Role to add new permission to", isSearchable: false, value: this.state.type, options: dashboardAclTargets, onChange: this.onTypeChanged }),
                newItem.type === AclTarget.User ? (React.createElement(UserPicker, { onSelected: this.onUserSelected, className: pickerClassName })) : null,
                newItem.type === AclTarget.Team ? (React.createElement(TeamPicker, { onSelected: this.onTeamSelected, className: pickerClassName })) : null,
                React.createElement("span", { className: styles.label }, "Can"),
                React.createElement(Select, { "aria-label": "Permission level", isSearchable: false, value: this.state.permission, options: dashboardPermissionLevels, onChange: this.onPermissionChanged, width: 25 }),
                React.createElement(Button, { "data-save-permission": true, type: "submit", disabled: !isValid }, "Save"))))));
    }
}
AddPermissions.defaultProps = {
    showPermissionLevels: true,
};
const getStyles = stylesFactory((theme) => ({
    label: css `
    color: ${theme.colors.primary.text};
    font-weight: bold;
  `,
}));
export default AddPermissions;
//# sourceMappingURL=AddPermission.js.map