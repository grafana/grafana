import { render, screen } from '@testing-library/react';
import React from 'react';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { DbServiceAgent } from 'app/percona/shared/services/services/Services.types';

import { ServiceAgentStatus } from '../../Inventory.types';

import { StatusLink } from './StatusLink';

describe('StatusLink', () => {
  it('should show "OK" if agents are running, starting or connected', () => {
    const agents: DbServiceAgent[] = [
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

    render(
      <Router history={locationService.getHistory()}>
        <StatusLink agents={agents} strippedServiceId="service_id_1" />
      </Router>
    );

    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('should show "Failed" if some agent is not connected', () => {
    const agents: DbServiceAgent[] = [
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

    render(
      <Router history={locationService.getHistory()}>
        <StatusLink agents={agents} strippedServiceId="service_id_1" />
      </Router>
    );

    expect(screen.queryByText('OK')).not.toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should show "Failed" if some agent is not starting or running', () => {
    const agents: DbServiceAgent[] = [
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

    render(
      <Router history={locationService.getHistory()}>
        <StatusLink agents={agents} strippedServiceId="service_id_1" />
      </Router>
    );

    expect(screen.queryByText('OK')).not.toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
