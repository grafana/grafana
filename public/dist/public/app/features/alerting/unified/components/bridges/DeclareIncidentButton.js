import React from 'react';
import { Button, LinkButton, Tooltip } from '@grafana/ui';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createBridgeURL } from '../PluginBridge';
export const DeclareIncident = ({ title = '', severity = '', url = '' }) => {
    const bridgeURL = createBridgeURL(SupportedPlugin.Incident, '/incidents/declare', { title, severity, url });
    const { loading, installed, settings } = usePluginBridge(SupportedPlugin.Incident);
    return (React.createElement(React.Fragment, null,
        loading === true && (React.createElement(Button, { icon: "fire", size: "sm", type: "button", disabled: true }, "Declare Incident")),
        installed === false && (React.createElement(Tooltip, { content: 'Grafana Incident is not installed or is not configured correctly' },
            React.createElement(Button, { icon: "fire", size: "sm", type: "button", disabled: true }, "Declare Incident"))),
        settings && (React.createElement(LinkButton, { icon: "fire", size: "sm", type: "button", href: bridgeURL }, "Declare Incident"))));
};
//# sourceMappingURL=DeclareIncidentButton.js.map