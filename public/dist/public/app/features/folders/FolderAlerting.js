import { __awaiter } from "tslib";
import React from 'react';
import { useAsync } from 'react-use';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useDispatch, useSelector } from 'app/types';
import { AlertsFolderView } from '../alerting/unified/AlertsFolderView';
import { getFolderByUid } from './state/actions';
import { getLoadingNav } from './state/navModel';
const FolderAlerting = ({ match }) => {
    const dispatch = useDispatch();
    const navIndex = useSelector((state) => state.navIndex);
    const folder = useSelector((state) => state.folder);
    const uid = match.params.uid;
    const pageNav = getNavModel(navIndex, `folder-alerting-${uid}`, getLoadingNav(1));
    const { loading } = useAsync(() => __awaiter(void 0, void 0, void 0, function* () { return dispatch(getFolderByUid(uid)); }), [getFolderByUid, uid]);
    return (React.createElement(Page, { navId: "dashboards/browse", pageNav: pageNav.main },
        React.createElement(Page.Contents, { isLoading: loading },
            React.createElement(AlertsFolderView, { folder: folder }))));
};
export default FolderAlerting;
//# sourceMappingURL=FolderAlerting.js.map