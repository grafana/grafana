import React, { useCallback } from 'react';
import { Button, VerticalGroup } from '@grafana/ui';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { PanelEditorTabId } from './types';
import { locationService } from '@grafana/runtime';
export function PanelNotSupported(_a) {
    var message = _a.message;
    var onBackToQueries = useCallback(function () {
        locationService.partial({ tab: PanelEditorTabId.Query });
    }, []);
    return (React.createElement(Layout, { justify: "center", style: { marginTop: '100px' } },
        React.createElement(VerticalGroup, { spacing: "md" },
            React.createElement("h2", null, message),
            React.createElement("div", null,
                React.createElement(Button, { size: "md", variant: "secondary", icon: "arrow-left", onClick: onBackToQueries }, "Go back to Queries")))));
}
//# sourceMappingURL=PanelNotSupported.js.map