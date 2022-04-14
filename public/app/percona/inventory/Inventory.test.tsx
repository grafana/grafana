import React from 'react';
import { Table } from 'app/percona/shared/components/Elements/Table/Table';
import { AGENTS_COLUMNS, NODES_COLUMNS, SERVICES_COLUMNS } from './Inventory.constants';
import { InventoryDataService } from './Inventory.tools';
import { render } from '@testing-library/react';

jest.mock('app/percona/settings/Settings.service');

// FIXME: types
describe('Inventory tables', () => {
  it('Agents table renders correct with right data', () => {
    const response = {
      pmm_agent: [{ agent_id: 'pmm-server', runs_on_node_id: 'pmm-server', connected: true }],
      node_exporter: [
        {
          agent_id: '/agent_id/262189d8-e10f-41c2-b0ae-73cc76be6968',
          pmm_agent_id: 'pmm-server',
          status: 'RUNNING',
          listen_port: 42000,
        },
      ],
      postgres_exporter: [
        {
          agent_id: '/agent_id/8b74c54e-4307-4a10-9a6f-1646215cbe07',
          pmm_agent_id: 'pmm-server',
          service_id: '/service_id/ab477624-4ee9-49cd-8bd4-9bf3b91628b2',
          username: 'pmm-managed',
          status: 'RUNNING',
          listen_port: 42001,
        },
      ],
      qan_postgresql_pgstatements_agent: [
        {
          agent_id: '/agent_id/ac55153c-5211-4072-a5de-59eb2a136a5c',
          pmm_agent_id: 'pmm-server',
          service_id: '/service_id/ab477624-4ee9-49cd-8bd4-9bf3b91628b2',
          username: 'pmm-managed',
          status: 'RUNNING',
        },
      ],
    };

    const { container } = render(
      <Table
        data={InventoryDataService.getAgentModel(response as any)}
        rowKey={(rec) => rec.agent_id}
        columns={AGENTS_COLUMNS}
        loading={false}
      />
    );

    // length is 5 because header is also tr
    expect(container.querySelectorAll('tr')).toHaveLength(5);
  });

  it('Services table renders correct with right data', () => {
    const response = {
      postgresql: [
        {
          service_id: '/service_id/ab477624-4ee9-49cd-8bd4-9bf3b91628b2',
          service_name: 'pmm-server-postgresql',
          node_id: 'pmm-server',
          address: '127.0.0.1',
          port: 5432,
        },
      ],
    };
    const { container } = render(
      <Table
        data={InventoryDataService.getServiceModel(response as any)}
        rowKey={(rec) => rec.service_id}
        columns={SERVICES_COLUMNS}
        loading={false}
      />
    );

    // length is 2 because header is also tr
    expect(container.querySelectorAll('tr')).toHaveLength(2);
  });

  it('Nodes table renders correct with right data', () => {
    const response = {
      generic: [
        { node_id: 'pmm-server', node_name: 'pmm-server', address: '127.0.0.1' },
        { node_id: 'pmm-server2', node_name: 'pmm-server2', address: '127.0.0.1' },
      ],
    };
    const { container } = render(
      <Table
        data={InventoryDataService.getNodeModel(response as any)}
        rowKey={(rec) => rec.node_id}
        columns={NODES_COLUMNS}
        loading={false}
      />
    );

    // length is 3 because header is also tr
    expect(container.querySelectorAll('tr')).toHaveLength(3);
  });
});
