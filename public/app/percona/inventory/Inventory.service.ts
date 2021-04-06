import { api } from 'app/percona/shared/helpers/api';
import { Databases } from '../shared/core';
import { DBServiceList, ServiceListPayload } from './Inventory.types';

const BASE_URL = `/v1/inventory`;

interface RemoveServiceBody {
  service_id: string;
  force: boolean;
}
interface RemoveAgentBody {
  agent_id: string;
  force: boolean;
}
interface RemoveNodeBody {
  node_id: string;
  force: boolean;
}

export const InventoryService = {
  getAgents(body = {}) {
    return api.post<any, any>(`${BASE_URL}/Agents/List`, body);
  },
  removeAgent(body: RemoveAgentBody) {
    return api.post<any, any>(`${BASE_URL}/Agents/Remove`, body);
  },
  getServices(body = {}) {
    return api.post<any, any>(`${BASE_URL}/Services/List`, body);
  },
  // TODO unify typings and this function with getServices()
  async getDbServices(): Promise<DBServiceList> {
    const response = await api.post<ServiceListPayload, any>(`${BASE_URL}/Services/List`, {});
    const result: DBServiceList = {};

    Object.keys(response).forEach((db: Databases) => {
      const dbServices = response[db];

      if (dbServices?.length) {
        result[db] = dbServices.map(({ service_id, service_name }) => ({
          id: service_id,
          name: service_name,
        }));
      }
    });

    return result;
  },
  removeService(body: RemoveServiceBody) {
    return api.post<any, any>(`${BASE_URL}/Services/Remove`, body);
  },
  getNodes(body = {}) {
    return api.post<any, any>(`${BASE_URL}/Nodes/List`, body);
  },
  removeNode(body: RemoveNodeBody) {
    return api.post<any, any>(`${BASE_URL}/Nodes/Remove`, body);
  },
};
