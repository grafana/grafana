/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import {
  CompatibleServiceListPayload,
  DBServiceList,
  NodeListDBPayload,
  RemoveNodeBody,
  ServiceAgentListPayload,
} from './Inventory.types';

const BASE_URL = `/v1/inventory`;

export const InventoryService = {
  getAgents(serviceId: string | undefined, nodeId: string | undefined, token?: CancelToken) {
    return api.get<ServiceAgentListPayload, object>('/v1/management/agents', false, {
      cancelToken: token,
      params: {
        service_id: serviceId,
        node_id: nodeId,
      },
    });
  },
  removeAgent(agentId: string, forceMode = false, token?: CancelToken) {
    // todo: address forceMode
    return api.delete<void>(`${BASE_URL}/agents/${agentId}`, false, token, { force: forceMode });
  },
  // TODO unify typings and this function with getServices()
  async getDbServices(token?: CancelToken): Promise<DBServiceList> {
    const response = await api.get<CompatibleServiceListPayload, object>(`${BASE_URL}/services`, false, {
      cancelToken: token,
    });
    const result: DBServiceList = {};

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (Object.keys(response) as Array<keyof CompatibleServiceListPayload>).forEach((db) => {
      const dbServices = response[db];

      if (dbServices?.length) {
        result[db] = dbServices.map(({ service_id, service_name, cluster }) => ({
          id: service_id,
          name: service_name,
          cluster,
        }));
      }
    });

    return result;
  },
  getNodes(token?: CancelToken) {
    return api.get<NodeListDBPayload, object>(`/v1/management/nodes`, false, { cancelToken: token });
  },
  removeNode(body: RemoveNodeBody, token?: CancelToken) {
    return api.delete<void>(`${BASE_URL}/nodes/${body.node_id}`, false, token, { force: true });
  },
  getService(serviceId: string, cancelToken?: CancelToken) {
    return api.get<any, any>(`${BASE_URL}/services/${serviceId}`, false, { cancelToken });
  },
};
