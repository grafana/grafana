import React, { useCallback } from 'react';
import { locationService } from '@grafana/runtime';
import { Button, VerticalGroup } from '@grafana/ui';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { PanelEditorTabId } from './types';
export function PanelNotSupported({ message }) {
    const onBackToQueries = useCallback(() => {
        locationService.partial({ tab: PanelEditorTabId.Query });
    }, []);
    return (React.createElement(Layout, { justify: "center", style: { marginTop: '100px' } },
        React.createElement(VerticalGroup, { spacing: "md" },
            React.createElement("h2", null, message),
            React.createElement("div", null,
                React.createElement(Button, { size: "md", variant: "secondary", icon: "arrow-left", onClick: onBackToQueries }, "Go back to Queries")))));
}
//# sourceMappingURL=PanelNotSupported.js.map