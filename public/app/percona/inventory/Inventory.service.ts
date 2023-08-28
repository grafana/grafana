/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import {
  CompatibleServiceListPayload,
  DBServiceList,
  NodeListDBPayload,
  RemoveAgentBody,
  RemoveNodeBody,
  ServiceAgentListPayload,
} from './Inventory.types';

const BASE_URL = `/v1/inventory`;

export const InventoryService = {
  getAgents(serviceId: string | undefined, nodeId: string | undefined, token?: CancelToken) {
    return api.post<ServiceAgentListPayload, object>(
      '/v1/management/Agent/List',
      { service_id: serviceId, node_id: nodeId },
      false,
      token
    );
  },
  removeAgent(body: RemoveAgentBody, token?: CancelToken) {
    return api.post<void, object>(`${BASE_URL}/Agents/Remove`, body, false, token);
  },
  // TODO unify typings and this function with getServices()
  async getDbServices(token?: CancelToken): Promise<DBServiceList> {
    const response = await api.post<CompatibleServiceListPayload, object>(
      `${BASE_URL}/Services/List`,
      {},
      false,
      token
    );
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
  getNodes(body = {}, token?: CancelToken) {
    return api.post<NodeListDBPayload, object>(`/v1/management/Node/List`, body, false, token);
  },
  removeNode(body: RemoveNodeBody, token?: CancelToken) {
    return api.post<void, RemoveNodeBody>(`${BASE_URL}/Nodes/Remove`, body, false, token);
  },
  getService(serviceId: string, token?: CancelToken) {
    return api.post<any, any>(`${BASE_URL}/Services/Get`, { service_id: serviceId }, false, token);
  },
};
