import { render, screen } from '@testing-library/react';
import React from 'react';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';

import { ServiceAgentStatus } from '../../Inventory.types';

import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('should not render with empty agents list', () => {
    render(<StatusBadge agents={[]} strippedServiceId="" />);
    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
  });

  it('should render green if all agents are running or starting', () => {
    render(
      <Router history={locationService.getHistory()}>
        <StatusBadge
          agents={[
            { agentId: 'agent_1', status: ServiceAgentStatus.RUNNING },
            { agentId: 'agent_2', status: ServiceAgentStatus.STARTING },
            { agentId: 'agent_3', status: ServiceAgentStatus.STARTING },
          ]}
          strippedServiceId=""
        />
      </Router>
    );
    expect(screen.queryByTestId('status-badge-green')).toBeInTheDocument();
    expect(screen.queryByText('3/3 running')).toBeInTheDocument();
  });

  it('should render orange if some agent is not running or starting', () => {
    render(
      <Router history={locationService.getHistory()}>
        <StatusBadge
          agents={[
            { agentId: 'agent_1', status: ServiceAgentStatus.RUNNING },
            { agentId: 'agent_2', status: ServiceAgentStatus.STARTING },
            { agentId: 'agent_3', status: ServiceAgentStatus.DONE },
          ]}
          strippedServiceId=""
        />
      </Router>
    );
    expect(screen.queryByTestId('status-badge-orange')).toBeInTheDocument();
    expect(screen.queryByText('2/3 running')).toBeInTheDocument();
  });

  it('should render red if all agents are not running or starting', () => {
    render(
      <Router history={locationService.getHistory()}>
        <StatusBadge
          agents={[
            { agentId: 'agent_1', status: ServiceAgentStatus.STOPPING },
            { agentId: 'agent_2', status: ServiceAgentStatus.WAITING },
            { agentId: 'agent_3', status: ServiceAgentStatus.DONE },
          ]}
          strippedServiceId=""
        />
      </Router>
    );
    expect(screen.queryByTestId('status-badge-red')).toBeInTheDocument();
    expect(screen.queryByText('3/3 not running')).toBeInTheDocument();
  });
});
