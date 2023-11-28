import React, { useState } from 'react';
import { Collapse } from '@grafana/ui';
export const ContainerLogs = ({ containerLogs }) => {
    const { name, isOpen: isContainerOpen, logs } = containerLogs;
    const [isOpen, setIsOpen] = useState(isContainerOpen);
    return (React.createElement("div", { "data-testid": "dbcluster-logs" },
        React.createElement(Collapse, { collapsible: true, label: name, isOpen: isOpen, onToggle: () => setIsOpen(!isOpen) },
            React.createElement("pre", null, logs))));
};
//# sourceMappingURL=ContainerLogs.js.map