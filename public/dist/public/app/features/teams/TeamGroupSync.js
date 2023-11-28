import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Input, Tooltip, Icon, Button, useTheme2, InlineField, InlineFieldRow } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { UpgradeBox, UpgradeContent } from 'app/core/components/Upgrade/UpgradeBox';
import { highlightTrial } from 'app/features/admin/utils';
import { addTeamGroup, loadTeamGroups, removeTeamGroup } from './state/actions';
import { getTeamGroups } from './state/selectors';
function mapStateToProps(state) {
    return {
        groups: getTeamGroups(state.team),
    };
}
const mapDispatchToProps = {
    loadTeamGroups,
    addTeamGroup,
    removeTeamGroup,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
const headerTooltip = `Sync LDAP, OAuth or SAML groups with your Grafana teams.`;
export class TeamGroupSync extends PureComponent {
    constructor(props) {
        super(props);
        this.onToggleAdding = () => {
            this.setState({ isAdding: !this.state.isAdding });
        };
        this.onNewGroupIdChanged = (event) => {
            this.setState({ newGroupId: event.target.value });
        };
        this.onAddGroup = (event) => {
            event.preventDefault();
            this.props.addTeamGroup(this.state.newGroupId);
            this.setState({ isAdding: false, newGroupId: '' });
        };
        this.onRemoveGroup = (group) => {
            this.props.removeTeamGroup(group.groupId);
        };
        this.state = { isAdding: false, newGroupId: '' };
    }
    componentDidMount() {
        this.fetchTeamGroups();
    }
    fetchTeamGroups() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.props.loadTeamGroups();
        });
    }
    isNewGroupValid() {
        return this.state.newGroupId.length > 1;
    }
    renderGroup(group) {
        const { isReadOnly } = this.props;
        return (React.createElement("tr", { key: group.groupId },
            React.createElement("td", null, group.groupId),
            React.createElement("td", { style: { width: '1%' } },
                React.createElement(Button, { size: "sm", variant: "destructive", onClick: () => this.onRemoveGroup(group), disabled: isReadOnly, "aria-label": `Remove group ${group.groupId}` },
                    React.createElement(Icon, { name: "times" })))));
    }
    render() {
        const { isAdding, newGroupId } = this.state;
        const { groups, isReadOnly } = this.props;
        return (React.createElement("div", null,
            highlightTrial() && (React.createElement(UpgradeBox, { featureId: 'team-sync', eventVariant: 'trial', featureName: 'team sync', text: 'Add a group to enable team sync for free during your trial of Grafana Pro.' })),
            React.createElement("div", { className: "page-action-bar" },
                (!highlightTrial() || groups.length > 0) && (React.createElement(React.Fragment, null,
                    React.createElement("h3", { className: "page-sub-heading" }, "External group sync"),
                    React.createElement(Tooltip, { placement: "auto", content: headerTooltip },
                        React.createElement(Icon, { className: "icon--has-hover page-sub-heading-icon", name: "question-circle" })))),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                groups.length > 0 && (React.createElement(Button, { className: "pull-right", onClick: this.onToggleAdding, disabled: isReadOnly },
                    React.createElement(Icon, { name: "plus" }),
                    " Add group"))),
            React.createElement(SlideDown, { in: isAdding },
                React.createElement("div", { className: "cta-form" },
                    React.createElement(CloseButton, { onClick: this.onToggleAdding }),
                    React.createElement("form", { onSubmit: this.onAddGroup },
                        React.createElement(InlineFieldRow, null,
                            React.createElement(InlineField, { label: 'Add External Group', tooltip: "LDAP Group Example: cn=users,ou=groups,dc=grafana,dc=org." },
                                React.createElement(Input, { type: "text", id: 'add-external-group', placeholder: "", value: newGroupId, onChange: this.onNewGroupIdChanged, disabled: isReadOnly })),
                            React.createElement(Button, { type: "submit", disabled: isReadOnly || !this.isNewGroupValid(), style: { marginLeft: 4 } }, "Add group"))))),
            groups.length === 0 &&
                !isAdding &&
                (highlightTrial() ? (React.createElement(TeamSyncUpgradeContent, { action: { onClick: this.onToggleAdding, text: 'Add group' } })) : (React.createElement(EmptyListCTA, { onClick: this.onToggleAdding, buttonIcon: "users-alt", title: "There are no external groups to sync with", buttonTitle: "Add group", proTip: headerTooltip, proTipLinkTitle: "Learn more", proTipLink: "https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-team-sync/", proTipTarget: "_blank", buttonDisabled: isReadOnly }))),
            groups.length > 0 && (React.createElement("div", { className: "admin-list-table" },
                React.createElement("table", { className: "filter-table filter-table--hover form-inline" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "External Group ID"),
                            React.createElement("th", { style: { width: '1%' } }))),
                    React.createElement("tbody", null, groups.map((group) => this.renderGroup(group))))))));
    }
}
export const TeamSyncUpgradeContent = ({ action }) => {
    const theme = useTheme2();
    return (React.createElement(UpgradeContent, { action: action, listItems: [
            'Stop managing user access in two places - assign users to groups in SAML, LDAP or Oauth, and manage access at a Team level in Grafana',
            'Update users’ permissions immediately when you add or remove them from an LDAP group, with no need for them to sign out and back in',
        ], image: `team-sync-${theme.isLight ? 'light' : 'dark'}.png`, featureName: 'team sync', featureUrl: 'https://grafana.com/docs/grafana/latest/enterprise/team-sync', description: 'Team Sync makes it easier for you to manage users’ access in Grafana, by immediately updating each user’s Grafana teams and permissions based on their single sign-on group membership, instead of when users sign in.' }));
};
export default connect(mapStateToProps, mapDispatchToProps)(TeamGroupSync);
//# sourceMappingURL=TeamGroupSync.js.map