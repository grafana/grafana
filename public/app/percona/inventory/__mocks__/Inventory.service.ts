import * as service from 'app/percona/inventory/Inventory.service';
import { AgentType, DBServiceList, ServiceAgentStatus } from 'app/percona/inventory/Inventory.types';
import { ServiceStatus, ServiceType } from 'app/percona/shared/services/services/Services.types';

export const stubWithLabels = {
  service_id: 'service_id',
  service_name: 'mysql-with-labels',
  node_id: 'node_id',
  address: 'mysql',
  port: 3306,
  environment: 'Env',
  cluster: 'Clu',
  replication_set: 'Repl',
  custom_labels: {
    label: 'value',
    label2: 'value2',
  },
};

export const stubs: DBServiceList = {
  mysql: [
    {
      id: 'service_1',
      name: 'Service 1',
    },
    {
      id: 'service_2',
      name: 'Service 2',
    },
  ],
};

export const nodesMock = [
  {
    node_id: 'pmm-server',
    node_type: 'generic',
    node_name: 'pmm-server',
    machine_id: '',
    distro: '',
    node_model: '',
    container_id: '',
    container_name: '',
    address: '127.0.0.1',
    region: '',
    az: '',
    custom_labels: {},
    created_at: '2024-08-20T08:05:31.079300Z',
    updated_at: '2024-08-20T08:05:31.079300Z',
    status: ServiceStatus.UP,
    agents: [
      {
        agent_id: '05af4544-8fd0-4788-b841-89ed6caa9ac1',
        agent_type: AgentType.nodeExporter,
        status: ServiceAgentStatus.RUNNING,
        is_connected: false,
      },
      {
        agent_id: 'pmm-server',
        agent_type: AgentType.pmmAgent,
        status: ServiceAgentStatus.RUNNING,
        is_connected: true,
      },
    ],
    services: [
      {
        service_id: '291afb9b-2ae0-41d1-a173-f1a138cf1725',
        service_type: ServiceType.posgresql,
        service_name: 'pmm-server-postgresql',
      },
    ],
  },
];

export const nodesMockMultipleAgentsNoPMMServer = [
  {
    node_id: '324234234',
    node_type: 'generic',
    node_name: 'node1',
    custom_labels: {},
    machine_id: '',
    distro: '',
    node_model: '',
    container_id: '',
    container_name: '',
    address: '127.0.0.1',
    region: '',
    az: '',
    created_at: '2024-08-20T08:05:31.079300Z',
    updated_at: '2024-08-20T08:05:31.079300Z',
    status: ServiceStatus.UP,
    agents: [
      {
        agent_id: '05af4544-8fd0-4788-b841-89ed6caa9ac1',
        agent_type: AgentType.pmmAgent,
        status: ServiceAgentStatus.RUNNING,
        is_connected: false,
      },
      {
        agent_id: '12132132',
        agent_type: AgentType.pmmAgent,
        status: ServiceAgentStatus.RUNNING,
        is_connected: true,
      },
      {
        agent_id: '4534534534534',
        agent_type: AgentType.externalExporter,
        status: ServiceAgentStatus.RUNNING,
        is_connected: true,
      },
    ],
    services: [
      {
        service_id: '291afb9b-2ae0-41d1-a173-f1a138cf1725',
        service_type: ServiceType.posgresql,
        service_name: 'pmm-server-postgresql',
      },
    ],
  },
];

export const nodesMockOneAgentNoPMMServer = [
  {
    node_id: '324234234',
    node_type: 'generic',
    node_name: 'node2',
    custom_labels: {},
    machine_id: '',
    distro: '',
    node_model: '',
    container_id: '',
    container_name: '',
    address: '127.0.0.1',
    region: '',
    az: '',
    created_at: '2024-08-20T08:05:31.079300Z',
    updated_at: '2024-08-20T08:05:31.079300Z',
    status: ServiceStatus.UP,
    agents: [
      {
        agent_id: '12132132',
        agent_type: AgentType.pmmAgent,
        status: ServiceAgentStatus.RUNNING,
        is_connected: true,
      },
      {
        agent_id: '4534534534534',
        agent_type: AgentType.externalExporter,
        status: ServiceAgentStatus.RUNNING,
        is_connected: true,
      },
    ],
    services: [
      {
        service_id: '291afb9b-2ae0-41d1-a173-f1a138cf1725',
        service_type: ServiceType.posgresql,
        service_name: 'pmm-server-postgresql',
      },
    ],
  },
];

export const InventoryService = jest.genMockFromModule<typeof service>(
  'app/percona/inventory/Inventory.service'
).InventoryService;

InventoryService.getDbServices = () => Promise.resolve(stubs);

InventoryService.getService = () =>
  Promise.resolve({
    mysql: stubWithLabels,
  });

InventoryService.getNodes = () =>
  Promise.resolve({
    nodes: nodesMock,
  });
