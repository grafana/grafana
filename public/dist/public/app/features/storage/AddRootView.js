import React from 'react';
import { Button } from '@grafana/ui';
export function AddRootView({ onPathChange }) {
    return (React.createElement("div", null,
        React.createElement("div", null, "TODO... Add ROOT"),
        React.createElement(Button, { variant: "secondary", onClick: () => onPathChange('/') }, "Cancel")));
}
//# sourceMappingURL=AddRootView.js.map