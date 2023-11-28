import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { Permissions } from 'app/core/components/AccessControl';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { getNavModel } from 'app/core/selectors/navModel';
import { AccessControlAction } from 'app/types';
import { getFolderByUid } from './state/actions';
import { getLoadingNav } from './state/navModel';
function mapStateToProps(state, props) {
    const uid = props.match.params.uid;
    return {
        uid: uid,
        pageNav: getNavModel(state.navIndex, `folder-permissions-${uid}`, getLoadingNav(1)),
    };
}
const mapDispatchToProps = {
    getFolderByUid,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const AccessControlFolderPermissions = ({ uid, getFolderByUid, pageNav }) => {
    useEffect(() => {
        getFolderByUid(uid);
    }, [getFolderByUid, uid]);
    const canSetPermissions = contextSrv.hasPermission(AccessControlAction.FoldersPermissionsWrite);
    return (React.createElement(Page, { navId: "dashboards/browse", pageNav: pageNav.main },
        React.createElement(Page.Contents, null,
            React.createElement(Permissions, { resource: "folders", resourceId: uid, canSetPermissions: canSetPermissions }))));
};
export default connector(AccessControlFolderPermissions);
//# sourceMappingURL=AccessControlFolderPermissions.js.map