import { InventoryDataService } from './Inventory.tools';

describe('Inventory data service', () => {
  it('Transforms response for Agents correct', () => {
    const response = {
      pmm_agent: [
        {
          agent_id: '/agent_id/3f79e8d0-68f5-4c4b-b6bc-dd9c698c1350',
          runs_on_node_id: '/node_id/ef292f80-e7d4-49f1-af28-78a542a8e40e',
        },
        { agent_id: 'pmm-server', runs_on_node_id: 'pmm-server', connected: true },
      ],
      node_exporter: [
        {
          agent_id: '/agent_id/28ab095d-1289-40c5-b1df-64534b48f140',
          pmm_agent_id: '/agent_id/3f79e8d0-68f5-4c4b-b6bc-dd9c698c1350',
          status: 'RUNNING',
          listen_port: 42000,
        },
        {
          agent_id: '/agent_id/d8cd59d9-10b2-43f7-aeda-ef4c328e5778',
          pmm_agent_id: 'pmm-server',
          status: 'RUNNING',
          listen_port: 42001,
        },
      ],
      mongodb_exporter: [
        {
          agent_id: '/agent_id/d96683b3-356d-42aa-9807-4c52e93623e1',
          pmm_agent_id: '/agent_id/3f79e8d0-68f5-4c4b-b6bc-dd9c698c1350',
          service_id: '/service_id/0c84fe1a-67c1-4ee8-a463-d9fa0c1f72ac',
          username: 'mongo',
          status: 'RUNNING',
          listen_port: 42002,
        },
      ],
      postgres_exporter: [
        {
          agent_id: '/agent_id/9f4a409e-37cf-45d4-b088-e626ee951418',
          pmm_agent_id: 'pmm-server',
          service_id: '/service_id/687ab427-4dfa-41e1-9600-fe229e755867',
          username: 'pmm-managed',
          status: 'RUNNING',
          listen_port: 42000,
        },
      ],
      qan_mongodb_profiler_agent: [
        {
          agent_id: '/agent_id/7d15c655-9f86-473e-81b7-216db8e10789',
          pmm_agent_id: '/agent_id/3f79e8d0-68f5-4c4b-b6bc-dd9c698c1350',
          service_id: '/service_id/0c84fe1a-67c1-4ee8-a463-d9fa0c1f72ac',
          username: 'mongo',
          status: 'RUNNING',
        },
      ],
      qan_postgresql_pgstatements_agent: [
        {
          agent_id: '/agent_id/29e73921-9878-4546-9b33-4c151fc46ad4',
          pmm_agent_id: 'pmm-server',
          service_id: '/service_id/687ab427-4dfa-41e1-9600-fe229e755867',
          username: 'pmm-managed',
          status: 'RUNNING',
        },
      ],
    };
    const testTransformedData = [
      {
        custom_labels: [],
        type: 'MongoDB exporter',
        isDeleted: false,
        agent_id: '/agent_id/d96683b3-356d-42aa-9807-4c52e93623e1',
        pmm_agent_id: '/agent_id/3f79e8d0-68f5-4c4b-b6bc-dd9c698c1350',
        service_id: '/service_id/0c84fe1a-67c1-4ee8-a463-d9fa0c1f72ac',
        username: 'mongo',
        status: 'RUNNING',
        listen_port: 42002,
      },
      {
        custom_labels: [],
        type: 'Node exporter',
        isDeleted: false,
        agent_id: '/agent_id/28ab095d-1289-40c5-b1df-64534b48f140',
        pmm_agent_id: '/agent_id/3f79e8d0-68f5-4c4b-b6bc-dd9c698c1350',
        status: 'RUNNING',
        listen_port: 42000,
      },
      {
        custom_labels: [],
        type: 'Node exporter',
        isDeleted: false,
        agent_id: '/agent_id/d8cd59d9-10b2-43f7-aeda-ef4c328e5778',
        pmm_agent_id: 'pmm-server',
        status: 'RUNNING',
        listen_port: 42001,
      },
      {
        custom_labels: [],
        type: 'PMM Agent',
        isDeleted: false,
        agent_id: '/agent_id/3f79e8d0-68f5-4c4b-b6bc-dd9c698c1350',
        runs_on_node_id: '/node_id/ef292f80-e7d4-49f1-af28-78a542a8e40e',
      },
      {
        custom_labels: [],
        type: 'PMM Agent',
        isDeleted: false,
        agent_id: 'pmm-server',
        runs_on_node_id: 'pmm-server',
        connected: true,
      },
      {
        custom_labels: [],
        type: 'Postgres exporter',
        isDeleted: false,
        agent_id: '/agent_id/9f4a409e-37cf-45d4-b088-e626ee951418',
        pmm_agent_id: 'pmm-server',
        service_id: '/service_id/687ab427-4dfa-41e1-9600-fe229e755867',
        username: 'pmm-managed',
        status: 'RUNNING',
        listen_port: 42000,
      },
      {
        custom_labels: [],
        type: 'QAN MongoDB Profiler Agent',
        isDeleted: false,
        agent_id: '/agent_id/7d15c655-9f86-473e-81b7-216db8e10789',
        pmm_agent_id: '/agent_id/3f79e8d0-68f5-4c4b-b6bc-dd9c698c1350',
        service_id: '/service_id/0c84fe1a-67c1-4ee8-a463-d9fa0c1f72ac',
        username: 'mongo',
        status: 'RUNNING',
      },
      {
        custom_labels: [],
        type: 'QAN PostgreSQL PgStatements Agent',
        isDeleted: false,
        agent_id: '/agent_id/29e73921-9878-4546-9b33-4c151fc46ad4',
        pmm_agent_id: 'pmm-server',
        service_id: '/service_id/687ab427-4dfa-41e1-9600-fe229e755867',
        username: 'pmm-managed',
        status: 'RUNNING',
      },
    ];

    // FIXME: types
    expect(InventoryDataService.getAgentModel(response as any)).toEqual(testTransformedData);
  });

  it('Transforms response for Services correct', () => {
    const response = {
      mongodb: [
        {
          service_id: '/service_id/0c84fe1a-67c1-4ee8-a463-d9fa0c1f72ac',
          service_name: 'MongoDB',
          node_id: '/node_id/ef292f80-e7d4-49f1-af28-78a542a8e40e',
          address: 'mongo',
          port: 27017,
        },
      ],
      postgresql: [
        {
          service_id: '/service_id/687ab427-4dfa-41e1-9600-fe229e755867',
          service_name: 'pmm-server-postgresql',
          node_id: 'pmm-server',
          address: '127.0.0.1',
          port: 5432,
        },
      ],
    };
    const testTransformedData = [
      {
        custom_labels: [],
        type: 'MongoDB',
        isDeleted: false,
        service_id: '/service_id/0c84fe1a-67c1-4ee8-a463-d9fa0c1f72ac',
        service_name: 'MongoDB',
        node_id: '/node_id/ef292f80-e7d4-49f1-af28-78a542a8e40e',
        address: 'mongo',
        port: 27017,
      },
      {
        custom_labels: [],
        type: 'PostgreSQL',
        isDeleted: false,
        service_id: '/service_id/687ab427-4dfa-41e1-9600-fe229e755867',
        service_name: 'pmm-server-postgresql',
        node_id: 'pmm-server',
        address: '127.0.0.1',
        port: 5432,
      },
    ];

    // FIXME: types
    expect(InventoryDataService.getServiceModel(response as any)).toEqual(testTransformedData);
  });

  it('Transforms response for Nodes correct', () => {
    const response = {
      generic: [{ node_id: 'pmm-server', node_name: 'pmm-server', address: '127.0.0.1' }],
      container: [
        {
          node_id: '/node_id/ef292f80-e7d4-49f1-af28-78a542a8e40e',
          node_name: 'f803ef551888',
          address: '172.18.0.9',
          machine_id: '/machine_id/e568e8e9dbe3440dba8bf986e81a55dc',
        },
      ],
    };
    const testTransformedData = [
      {
        custom_labels: [],
        type: 'Container',
        isDeleted: false,
        node_id: '/node_id/ef292f80-e7d4-49f1-af28-78a542a8e40e',
        node_name: 'f803ef551888',
        address: '172.18.0.9',
        machine_id: '/machine_id/e568e8e9dbe3440dba8bf986e81a55dc',
      },
      {
        custom_labels: [],
        type: 'Generic',
        isDeleted: false,
        node_id: 'pmm-server',
        node_name: 'pmm-server',
        address: '127.0.0.1',
      },
    ];

    // FIXME: types
    expect(InventoryDataService.getNodeModel(response as any)).toEqual(testTransformedData);
  });

  it('Transform types for non existent entries', () => {
    const response = {
      some_random_node_type: [{ node_id: 'pmm-server', node_name: 'pmm-server', address: '127.0.0.1' }],
      container: [
        {
          node_id: '/node_id/ef292f80-e7d4-49f1-af28-78a542a8e40e',
          node_name: 'f803ef551888',
          address: '172.18.0.9',
          machine_id: '/machine_id/e568e8e9dbe3440dba8bf986e81a55dc',
        },
      ],
    };
    const testTransformedData = [
      {
        custom_labels: [],
        type: 'Container',
        isDeleted: false,
        node_id: '/node_id/ef292f80-e7d4-49f1-af28-78a542a8e40e',
        node_name: 'f803ef551888',
        address: '172.18.0.9',
        machine_id: '/machine_id/e568e8e9dbe3440dba8bf986e81a55dc',
      },
      {
        custom_labels: [],
        type: 'Some random node type',
        isDeleted: false,
        node_id: 'pmm-server',
        node_name: 'pmm-server',
        address: '127.0.0.1',
      },
    ];

    // FIXME: types
    expect(InventoryDataService.getNodeModel(response as any)).toEqual(testTransformedData);
  });
});
