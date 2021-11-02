import React from 'react';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'react-redux';
export var AlertingPageWrapper = function (_a) {
    var children = _a.children, pageId = _a.pageId, isLoading = _a.isLoading;
    var navModel = getNavModel(useSelector(function (state) { return state.navIndex; }), pageId);
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, { isLoading: isLoading }, children)));
};
//# sourceMappingURL=AlertingPageWrapper.js.map