import * as tslib_1 from "tslib";
import config from 'app/core/config';
export function buildNavModel(team) {
    var navModel = {
        img: team.avatarUrl,
        id: 'team-' + team.id,
        subTitle: 'Manage members & settings',
        url: '',
        text: team.name,
        breadcrumbs: [{ title: 'Teams', url: 'org/teams' }],
        children: [
            {
                active: false,
                icon: 'gicon gicon-team',
                id: "team-members-" + team.id,
                text: 'Members',
                url: "org/teams/edit/" + team.id + "/members",
            },
            {
                active: false,
                icon: 'fa fa-fw fa-sliders',
                id: "team-settings-" + team.id,
                text: 'Settings',
                url: "org/teams/edit/" + team.id + "/settings",
            },
        ],
    };
    if (config.buildInfo.isEnterprise) {
        navModel.children.push({
            active: false,
            icon: 'fa fa-fw fa-refresh',
            id: "team-groupsync-" + team.id,
            text: 'External group sync',
            url: "org/teams/edit/" + team.id + "/groupsync",
        });
    }
    return navModel;
}
export function getTeamLoadingNav(pageName) {
    var e_1, _a;
    var main = buildNavModel({
        avatarUrl: 'public/img/user_profile.png',
        id: 1,
        name: 'Loading',
        email: 'loading',
        memberCount: 0,
    });
    var node;
    try {
        // find active page
        for (var _b = tslib_1.__values(main.children), _c = _b.next(); !_c.done; _c = _b.next()) {
            var child = _c.value;
            if (child.id.indexOf(pageName) > 0) {
                child.active = true;
                node = child;
                break;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return {
        main: main,
        node: node,
    };
}
//# sourceMappingURL=navModel.js.map