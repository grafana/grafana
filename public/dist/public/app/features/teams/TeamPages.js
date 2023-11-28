import { __awaiter } from "tslib";
import { includes } from 'lodash';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { featureEnabled } from '@grafana/runtime';
import { withTheme2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { UpgradeBox } from 'app/core/components/Upgrade/UpgradeBox';
import config from 'app/core/config';
import { getNavModel } from 'app/core/selectors/navModel';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import TeamGroupSync, { TeamSyncUpgradeContent } from './TeamGroupSync';
import TeamPermissions from './TeamPermissions';
import TeamSettings from './TeamSettings';
import { loadTeam } from './state/actions';
import { getTeamLoadingNav } from './state/navModel';
import { getTeam } from './state/selectors';
var PageTypes;
(function (PageTypes) {
    PageTypes["Members"] = "members";
    PageTypes["Settings"] = "settings";
    PageTypes["GroupSync"] = "groupsync";
})(PageTypes || (PageTypes = {}));
function mapStateToProps(state, props) {
    var _a;
    const teamId = parseInt(props.match.params.id, 10);
    const team = getTeam(state.team, teamId);
    let defaultPage = 'members';
    // With RBAC the settings page will always be available
    if (!team || !contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsRead, team)) {
        defaultPage = 'settings';
    }
    const pageName = (_a = props.match.params.page) !== null && _a !== void 0 ? _a : defaultPage;
    const teamLoadingNav = getTeamLoadingNav(pageName);
    const pageNav = getNavModel(state.navIndex, `team-${pageName}-${teamId}`, teamLoadingNav).main;
    return {
        pageNav,
        teamId: teamId,
        pageName: pageName,
        team,
    };
}
const mapDispatchToProps = {
    loadTeam,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class TeamPages extends PureComponent {
    constructor(props) {
        super(props);
        this.textsAreEqual = (text1, text2) => {
            if (!text1 && !text2) {
                return true;
            }
            if (!text1 || !text2) {
                return false;
            }
            return text1.toLocaleLowerCase() === text2.toLocaleLowerCase();
        };
        this.state = {
            isLoading: false,
            isSyncEnabled: featureEnabled('teamsync'),
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.fetchTeam();
        });
    }
    fetchTeam() {
        return __awaiter(this, void 0, void 0, function* () {
            const { loadTeam, teamId } = this.props;
            this.setState({ isLoading: true });
            const team = yield loadTeam(teamId);
            this.setState({ isLoading: false });
            return team;
        });
    }
    getCurrentPage() {
        const pages = ['members', 'settings', 'groupsync'];
        const currentPage = this.props.pageName;
        return includes(pages, currentPage) ? currentPage : pages[0];
    }
    renderPage() {
        const { isSyncEnabled } = this.state;
        const { team } = this.props;
        const currentPage = this.getCurrentPage();
        const canReadTeam = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRead, team);
        const canReadTeamPermissions = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsRead, team);
        const canWriteTeamPermissions = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsWrite, team);
        switch (currentPage) {
            case PageTypes.Members:
                if (canReadTeamPermissions) {
                    return React.createElement(TeamPermissions, { team: team });
                }
            case PageTypes.Settings:
                return canReadTeam && React.createElement(TeamSettings, { team: team });
            case PageTypes.GroupSync:
                if (isSyncEnabled) {
                    if (canReadTeamPermissions) {
                        return React.createElement(TeamGroupSync, { isReadOnly: !canWriteTeamPermissions });
                    }
                }
                else if (config.featureToggles.featureHighlights) {
                    return (React.createElement(React.Fragment, null,
                        React.createElement(UpgradeBox, { featureName: 'team sync', featureId: 'team-sync' }),
                        React.createElement(TeamSyncUpgradeContent, null)));
                }
        }
        return null;
    }
    render() {
        const { team, pageNav } = this.props;
        return (React.createElement(Page, { navId: "teams", pageNav: pageNav },
            React.createElement(Page.Contents, { isLoading: this.state.isLoading }, team && Object.keys(team).length !== 0 && this.renderPage())));
    }
}
export default connector(withTheme2(TeamPages));
//# sourceMappingURL=TeamPages.js.map