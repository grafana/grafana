import React from 'react';
import _ from 'lodash';
import SignIn from './SignIn';
import BottomNavLinks from './BottomNavLinks';
import { contextSrv } from 'app/core/services/context_srv';
import config from '../../config';
export default function BottomSection() {
    var navTree = _.cloneDeep(config.bootData.navTree);
    var bottomNav = _.filter(navTree, function (item) { return item.hideFromMenu; });
    var isSignedIn = contextSrv.isSignedIn;
    var user = contextSrv.user;
    if (user && user.orgCount > 1) {
        var profileNode = _.find(bottomNav, { id: 'profile' });
        if (profileNode) {
            profileNode.showOrgSwitcher = true;
        }
    }
    return (React.createElement("div", { className: "sidemenu__bottom" },
        !isSignedIn && React.createElement(SignIn, null),
        bottomNav.map(function (link, index) {
            return React.createElement(BottomNavLinks, { link: link, user: user, key: link.url + "-" + index });
        })));
}
//# sourceMappingURL=BottomSection.js.map