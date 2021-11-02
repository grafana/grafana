import React from 'react';
import { HorizontalGroup, Tooltip, Button } from '@grafana/ui';
export var VersionsHistoryButtons = function (_a) {
    var hasMore = _a.hasMore, canCompare = _a.canCompare, getVersions = _a.getVersions, getDiff = _a.getDiff, isLastPage = _a.isLastPage;
    return (React.createElement(HorizontalGroup, null,
        hasMore && (React.createElement(Button, { type: "button", onClick: function () { return getVersions(true); }, variant: "secondary", disabled: isLastPage }, "Show more versions")),
        React.createElement(Tooltip, { content: "Select two versions to start comparing", placement: "bottom" },
            React.createElement(Button, { type: "button", disabled: canCompare, onClick: getDiff, icon: "code-branch" }, "Compare versions"))));
};
//# sourceMappingURL=VersionHistoryButtons.js.map