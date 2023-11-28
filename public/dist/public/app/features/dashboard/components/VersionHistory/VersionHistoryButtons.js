import React from 'react';
import { Stack } from '@grafana/experimental';
import { Tooltip, Button } from '@grafana/ui';
export const VersionsHistoryButtons = ({ hasMore, canCompare, getVersions, getDiff, isLastPage, }) => (React.createElement(Stack, null,
    hasMore && (React.createElement(Button, { type: "button", onClick: () => getVersions(true), variant: "secondary", disabled: isLastPage }, "Show more versions")),
    React.createElement(Tooltip, { content: "Select two versions to start comparing", placement: "bottom" },
        React.createElement(Button, { type: "button", disabled: !canCompare, onClick: getDiff, icon: "code-branch" }, "Compare versions"))));
//# sourceMappingURL=VersionHistoryButtons.js.map