import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { ServiceAgentStatus } from '../../Inventory.types';

import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('should not render with empty agents list', () => {
    render(<StatusBadge agents={[]} type="services" strippedId="" />);
    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
  });
  it('should render green if all agents are running or starting', () => {
    render(
      <MemoryRouter>
        <StatusBadge
          agents={[
            { agentId: 'agent_1', status: ServiceAgentStatus.RUNNING },
            { agentId: 'agent_2', status: ServiceAgentStatus.STARTING },
            { agentId: 'agent_3', status: ServiceAgentStatus.STARTING },
          ]}
          type="services"
          strippedId=""
        />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('status-badge-green')).toBeInTheDocument();
    expect(screen.queryByText('3/3 running')).toBeInTheDocument();
  });
  it('should render orange if some agent is not running or starting', () => {
    render(
      <MemoryRouter>
        <StatusBadge
          agents={[
            { agentId: 'agent_1', status: ServiceAgentStatus.RUNNING },
            { agentId: 'agent_2', status: ServiceAgentStatus.STARTING },
            { agentId: 'agent_3', status: ServiceAgentStatus.DONE },
          ]}
          type="services"
          strippedId=""
        />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('status-badge-orange')).toBeInTheDocument();
    expect(screen.queryByText('2/3 running')).toBeInTheDocument();
  });
  it('should render red if all agents are not running or starting', () => {
    render(
      <MemoryRouter>
        <StatusBadge
          agents={[
            { agentId: 'agent_1', status: ServiceAgentStatus.STOPPING },
            { agentId: 'agent_2', status: ServiceAgentStatus.WAITING },
            { agentId: 'agent_3', status: ServiceAgentStatus.DONE },
          ]}
          type="services"
          strippedId=""
        />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('status-badge-red')).toBeInTheDocument();
    expect(screen.queryByText('3/3 not running')).toBeInTheDocument();
  });
});
