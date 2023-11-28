import { render, screen } from '@testing-library/react';
import React from 'react';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { ServiceAgentStatus } from '../../Inventory.types';
import { getAgentsMonitoringStatus } from '../../Tabs/Services.utils';
import { StatusLink } from './StatusLink';
describe('StatusLink', () => {
    it('should show "OK" if agents are running, starting or connected', () => {
        const agents = [
            {
                agentId: 'agent1',
                status: ServiceAgentStatus.RUNNING,
            },
            {
                agentId: 'agent2',
                status: ServiceAgentStatus.STARTING,
            },
            {
                agentId: 'agent3',
                isConnected: true,
            },
        ];
        const agentsStatus = getAgentsMonitoringStatus(agents);
        render(React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(StatusLink, { agentsStatus: agentsStatus, type: "services", strippedId: "service_id_1" })));
        expect(screen.getByText('OK')).toBeInTheDocument();
        expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    });
    it('should show "Failed" if some agent is not connected', () => {
        const agents = [
            {
                agentId: 'agent1',
                status: ServiceAgentStatus.RUNNING,
            },
            {
                agentId: 'agent2',
                status: ServiceAgentStatus.STARTING,
            },
            {
                agentId: 'agent3',
                isConnected: false,
            },
        ];
        const agentsStatus = getAgentsMonitoringStatus(agents);
        render(React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(StatusLink, { agentsStatus: agentsStatus, type: "services", strippedId: "service_id_1" })));
        expect(screen.queryByText('OK')).not.toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
    });
    it('should show "Failed" if some agent is not starting or running', () => {
        const agents = [
            {
                agentId: 'agent1',
                status: ServiceAgentStatus.RUNNING,
            },
            {
                agentId: 'agent2',
                status: ServiceAgentStatus.STOPPING,
            },
            {
                agentId: 'agent3',
                isConnected: true,
            },
        ];
        const agentsStatus = getAgentsMonitoringStatus(agents);
        render(React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(StatusLink, { agentsStatus: agentsStatus, type: "services", strippedId: "service_id_1" })));
        expect(screen.queryByText('OK')).not.toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
    });
});
//# sourceMappingURL=StatusLink.test.js.map