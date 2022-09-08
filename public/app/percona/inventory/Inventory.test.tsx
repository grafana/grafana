/* eslint-disable @typescript-eslint/no-explicit-any */
import { Table } from '@percona/platform-core';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

import { AGENTS_COLUMNS, NODES_COLUMNS, SERVICES_COLUMNS } from './Inventory.constants';
import { InventoryDataService } from './Inventory.tools';

jest.mock('app/percona/settingsz/Settings.service');

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
    const data = InventoryDataService.getAgentModel(response as any);

    const { container } = render(
      <Table
        data={data}
        totalItems={data.length}
        rowSelection
        columns={AGENTS_COLUMNS}
        pendingRequest={false}
        showPagination
        pageSize={25}
      />
    );

    // length is 5 because header is also tr
    expect(container.querySelectorAll('tr')).toHaveLength(5);
  });

  it('Agents table only first page', async () => {
    const response = {
      pmm_agent: [{ agent_id: 'pmm-server', runs_on_node_id: 'pmm-server', connected: true }],
      node_exporter: new Array(50).fill({
        agent_id: '/agent_id/262189d8-e10f-41c2-b0ae-73cc76be6968',
        pmm_agent_id: 'pmm-server',
        status: 'RUNNING',
        listen_port: 42000,
      }),
      postgres_exporter: new Array(50).fill({
        agent_id: '/agent_id/8b74c54e-4307-4a10-9a6f-1646215cbe07',
        pmm_agent_id: 'pmm-server',
        service_id: '/service_id/ab477624-4ee9-49cd-8bd4-9bf3b91628b2',
        username: 'pmm-managed',
        status: 'RUNNING',
        listen_port: 42001,
      }),

      qan_postgresql_pgstatements_agent: new Array(50).fill({
        agent_id: '/agent_id/ac55153c-5211-4072-a5de-59eb2a136a5c',
        pmm_agent_id: 'pmm-server',
        service_id: '/service_id/ab477624-4ee9-49cd-8bd4-9bf3b91628b2',
        username: 'pmm-managed',
        status: 'RUNNING',
      }),
    };
    const data = InventoryDataService.getAgentModel(response as any);

    const { container } = render(
      <Table
        data={data}
        totalItems={data.length}
        rowSelection
        columns={AGENTS_COLUMNS}
        pendingRequest={false}
        showPagination
        pageSize={25}
      />
    );

    // default page size is 25
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(25));
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
    const data = InventoryDataService.getServiceModel(response as any);
    const { container } = render(
      <Table
        data={data}
        totalItems={data.length}
        columns={SERVICES_COLUMNS}
        pendingRequest={false}
        rowSelection
        showPagination
        pageSize={25}
      />
    );

    // length is 2 because header is also tr
    expect(container.querySelectorAll('tr')).toHaveLength(2);
  });

  it('Services table renders only first page', async () => {
    const response = {
      postgresql: new Array(100).fill({
        service_id: '/service_id/ab477624-4ee9-49cd-8bd4-9bf3b91628b2',
        service_name: 'pmm-server-postgresql',
        node_id: 'pmm-server',
        address: '127.0.0.1',
        port: 5432,
      }),
    };
    const data = InventoryDataService.getServiceModel(response as any);
    const { container } = render(
      <Table
        data={data}
        totalItems={data.length}
        columns={SERVICES_COLUMNS}
        pendingRequest={false}
        rowSelection
        showPagination
        pageSize={25}
      />
    );

    // default page size is 25
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(25));
  });

  it('Nodes table renders correct with right data', () => {
    const response = {
      generic: [
        { node_id: 'pmm-server', node_name: 'pmm-server', address: '127.0.0.1' },
        { node_id: 'pmm-server2', node_name: 'pmm-server2', address: '127.0.0.1' },
      ],
    };
    const data = InventoryDataService.getNodeModel(response as any);
    const { container } = render(
      <Table
        data={data}
        totalItems={data.length}
        columns={NODES_COLUMNS}
        pendingRequest={false}
        rowSelection
        showPagination
        pageSize={25}
      />
    );

    // length is 3 because header is also tr
    expect(container.querySelectorAll('tr')).toHaveLength(3);
  });

  it('Nodes table renders first page only', async () => {
    const response = {
      generic: new Array(100).fill({ node_id: 'pmm-server', node_name: 'pmm-server', address: '127.0.0.1' }),
    };
    const data = InventoryDataService.getNodeModel(response as any);
    const { container } = render(
      <Table
        data={data}
        totalItems={data.length}
        columns={NODES_COLUMNS}
        pendingRequest={false}
        rowSelection
        showPagination
        pageSize={25}
      />
    );

    // default page size is 25
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(25));
  });
});
