import { Node, NodeListPayload, NodeType } from 'app/percona/shared/services/nodes/Nodes.types';

import { toDbNodesModel } from './nodes.utils';

describe('toDbNodesModel', () => {
  it('should correctly convert payload', () => {
    const payload: NodeListPayload = {
      generic: [
        {
          node_id: 'node1',
          node_name: 'Node one',
          address: 'localhost',
          node_model: 'model',
          region: 'us',
          distro: 'unix',
        },
      ],
      container: [
        {
          node_id: 'node2',
          node_name: 'Node two',
          address: 'localhost',
          machine_id: 'machine1',
          container_id: 'container1',
          container_name: 'container one',
          custom_labels: {
            env_name: 'dev',
          },
        },
      ],
      remote_azure_database: [
        {
          node_id: 'node3',
          node_name: 'Node three',
          address: 'localhost',
          az: 'az',
        },
      ],
    };

    expect(toDbNodesModel(payload)).toEqual<Node[]>([
      {
        type: NodeType.generic,
        params: {
          nodeId: 'node1',
          nodeName: 'Node one',
          address: 'localhost',
          customLabels: {
            node_model: 'model',
            region: 'us',
            distro: 'unix',
          },
        },
      },
      {
        type: NodeType.container,
        params: {
          nodeId: 'node2',
          nodeName: 'Node two',
          address: 'localhost',
          customLabels: {
            machine_id: 'machine1',
            container_id: 'container1',
            container_name: 'container one',
            env_name: 'dev',
          },
        },
      },
      {
        type: NodeType.remoteAzureDB,
        params: {
          nodeId: 'node3',
          nodeName: 'Node three',
          address: 'localhost',
          customLabels: {
            az: 'az',
          },
        },
      },
    ]);
  });
});
