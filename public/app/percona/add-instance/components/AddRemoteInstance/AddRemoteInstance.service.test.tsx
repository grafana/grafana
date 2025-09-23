import { toExternalServicePayload, toPayload } from './AddRemoteInstance.service';

describe('AddRemoteInstanceService:: ', () => {
  it('should properly convert remote external service form to a payload', () => {
    const data = {
      tracking: 'qan_postgresql_pgstatements_agent',
      group: 'test',
      url: 'http://admin:admin@localhost/graph',
      schema: 'http',
      address: 'localhost',
      port: '80',
      metrics_path: '/graph',
      username: 'admin',
      password: 'admin',
      environment: 'test',
      region: 'test',
      az: 'test',
      replication_set: 'test',
      cluster: 'test',
      custom_labels: 'test:test',
    };

    const payload = {
      group: 'test',
      service_name: 'localhost',
      url: 'http://admin:admin@localhost/graph',
      schema: 'http',
      address: 'localhost',
      metrics_path: '/graph',
      username: 'admin',
      password: 'admin',
      environment: 'test',
      region: 'test',
      az: 'test',
      replication_set: 'test',
      cluster: 'test',
      custom_labels: {
        test: 'test',
      },
      add_node: {
        node_name: 'localhost',
        node_type: 'NODE_TYPE_REMOTE_NODE',
      },
      listen_port: '80',
      metrics_mode: 1,
    };

    expect(toExternalServicePayload(data)).toStrictEqual(payload);
  });

  it('should properly convert remote instance form to a payload', () => {
    const data = {
      tracking: 'qan_postgresql_pgstatements_agent',
      group: 'test',
      url: 'http://admin:admin@localhost/graph',
      schema: 'http',
      address: 'localhost',
      port: '80',
      metrics_path: '/graph',
      username: 'admin',
      password: 'admin',
      environment: 'test',
      region: 'test',
      az: 'test',
      replication_set: 'test',
      cluster: 'test',
      custom_labels: 'test:test',
      pmm_agent_id: {
        value: 'pmm-server',
      },
      node: {
        value: 'node1',
        label: 'node1',
      },
    };

    const payload = {
      group: 'test',
      service_name: 'localhost',
      url: 'http://admin:admin@localhost/graph',
      schema: 'http',
      address: 'localhost',
      metrics_path: '/graph',
      username: 'admin',
      password: 'admin',
      environment: 'test',
      region: 'test',
      az: 'test',
      replication_set: 'test',
      cluster: 'test',
      custom_labels: {
        test: 'test',
      },
      pmm_agent_id: 'pmm-server',
      port: '80',
      qan_postgresql_pgstatements_agent: true,
      metrics_mode: 1,
      node_id: 'node1',
    };
    expect(toPayload(data)).toStrictEqual(payload);
  });
});
