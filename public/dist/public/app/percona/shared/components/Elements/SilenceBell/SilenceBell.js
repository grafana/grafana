import { __awaiter } from "tslib";
import React, { useState, useCallback } from 'react';
import { IconButton, Spinner } from '@grafana/ui';
export const SilenceBell = ({ silenced, tooltip = '', onClick = () => null }) => {
    const [loading, setLoading] = useState(false);
    const handleClick = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setLoading(true);
        yield onClick();
        setLoading(false);
    }), [onClick]);
    return loading ? (React.createElement(Spinner, null)) : (React.createElement(IconButton, { tooltipPlacement: "top", tooltip: tooltip, onClick: handleClick, name: silenced ? 'percona-bell' : 'percona-bell-slash', iconType: "mono", "data-testid": "silence-button", title: tooltip }));
};
//# sourceMappingURL=SilenceBell.js.map