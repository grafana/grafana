export const list = () =>
  Promise.resolve([
    {
      dump_id: '123',
      status: 'BACKUP_STATUS_INVALID',
      node_ids: ['1', '2', '3'],
      start_time: '2023-09-20T18:55:53.486Z',
      end_time: '2023-09-20T18:57:53.486Z',
      created_at: '2023-09-26T07:40:01.547Z',
    },
  ]);

export const getNode = () =>
  Promise.resolve({
    generic: {
      node_id: '1',
      node_name: 'mongo-60-cfg-0.demo.local-mongodb',
      address: 'string',
      machine_id: 'string',
      distro: 'string',
      node_model: 'string',
      region: 'string',
      az: 'string',
      custom_labels: {
        additionalProp1: 'string',
        additionalProp2: 'string',
        additionalProp3: 'string',
      },
    },
    container: {
      node_id: 'string',
      node_name: 'string',
      address: 'string',
      machine_id: 'string',
      container_id: 'string',
      container_name: 'string',
      node_model: 'string',
      region: 'string',
      az: 'string',
      custom_labels: {
        additionalProp1: 'string',
        additionalProp2: 'string',
        additionalProp3: 'string',
      },
    },
    remote: {
      node_id: 'string',
      node_name: 'string',
      address: 'string',
      node_model: 'string',
      region: 'string',
      az: 'string',
      custom_labels: {
        additionalProp1: 'string',
        additionalProp2: 'string',
        additionalProp3: 'string',
      },
    },
    remote_rds: {
      node_id: 'string',
      node_name: 'string',
      address: 'string',
      node_model: 'string',
      region: 'string',
      az: 'string',
      custom_labels: {
        additionalProp1: 'string',
        additionalProp2: 'string',
        additionalProp3: 'string',
      },
    },
    remote_azure_database: {
      node_id: 'string',
      node_name: 'string',
      address: 'string',
      node_model: 'string',
      region: 'string',
      az: 'string',
      custom_labels: {
        additionalProp1: 'string',
        additionalProp2: 'string',
        additionalProp3: 'string',
      },
    },
  });

export const nodeList = (node_ids: string[]) =>
  Promise.resolve([
    {
      dump_id: '123',
      status: 'BACKUP_STATUS_INVALID',
      node_ids: ['1', '2', '3'],
      start_time: '2023-09-20T18:55:53.486Z',
      end_time: '2023-09-20T18:57:53.486Z',
      created_at: '2023-09-26T07:40:01.547Z',
    },
  ]);

export const deleteDump = (dumpId: string) => Promise.resolve();
