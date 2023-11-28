import React, { useState } from 'react';
import { Collapse, useStyles } from '@grafana/ui';
import { ContainerLogs } from '../ContainerLogs/ContainerLogs';
import { Messages } from './PodLogs.messages';
import { getStyles } from './PodLogs.styles';
export const PodLogs = ({ podLogs }) => {
    const styles = useStyles(getStyles);
    const { name, isOpen: isPodOpen, containers, events } = podLogs;
    const [isOpen, setIsOpen] = useState(isPodOpen);
    return (React.createElement("div", { "data-testid": "dbcluster-pod-logs" },
        React.createElement(Collapse, { collapsible: true, label: name, isOpen: isOpen, onToggle: () => setIsOpen(!isOpen) },
            React.createElement("span", { className: styles.label }, Messages.events),
            React.createElement("pre", { "data-testid": "dbcluster-pod-events", className: styles.labelSpacing }, events),
            React.createElement("span", { className: styles.label }, Messages.containers),
            React.createElement("div", { "data-testid": "dbcluster-containers", className: styles.labelSpacing }, containers.map((container) => (React.createElement(ContainerLogs, { key: `${container.name}${container.isOpen}`, containerLogs: container })))))));
};
//# sourceMappingURL=PodLogs.js.map