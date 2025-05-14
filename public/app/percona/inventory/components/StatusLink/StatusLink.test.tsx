import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { DbAgent } from 'app/percona/shared/services/services/Services.types';

import { ServiceAgentStatus } from '../../Inventory.types';
import { getAgentsMonitoringStatus } from '../../Tabs/Services.utils';

import { StatusLink } from './StatusLink';

describe('StatusLink', () => {
  it('should show "OK" if agents are running, starting or connected', () => {
    const agents: DbAgent[] = [
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
    render(
      <MemoryRouter>
        <StatusLink agentsStatus={agentsStatus} type="services" strippedId="service_id_1" />
      </MemoryRouter>
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });
  it('should show "Failed" if some agent is not connected', () => {
    const agents: DbAgent[] = [
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
    render(
      <MemoryRouter>
        <StatusLink agentsStatus={agentsStatus} type="services" strippedId="service_id_1" />
      </MemoryRouter>
    );
    expect(screen.queryByText('OK')).not.toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
  it('should show "Failed" if some agent is not starting or running', () => {
    const agents: DbAgent[] = [
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
    render(
      <MemoryRouter>
        <StatusLink agentsStatus={agentsStatus} type="services" strippedId="service_id_1" />
      </MemoryRouter>
    );
    expect(screen.queryByText('OK')).not.toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
