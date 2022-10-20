/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import { orderBy } from 'lodash';

import { inventoryTypes } from './Inventory.constants';
import { CustomLabel, InventoryList, InventoryType, ServicesList } from './Inventory.types';

export interface Model {
  custom_labels: CustomLabel[];
  type: string;
  isDeleted: boolean;
  [key: string]: any;
}

const getParams = (params: any, type: string): Model => {
  const { custom_labels, ...rest } = params;
  const labels =
    custom_labels && Object.keys(custom_labels).length
      ? Object.entries<string>(custom_labels).map<CustomLabel>(([key, value]) => ({ key, value }))
      : [];

  return {
    custom_labels: labels,
    type,
    isDeleted: false,
    ...rest,
  };
};

const getModel = (item: Partial<ServicesList>) => {
  const addType = Object.keys(item).map((type) => ({ type, params: item[type as InventoryType] || [] }));

  return addType.map((agent) =>
    agent.params.map((arrItem: any): Model => {
      const transformAgentType = (type: string) => type.replace(/^\w/, (c) => c.toUpperCase()).replace(/[_-]/g, ' ');
      // @ts-ignore
      const type = inventoryTypes[agent.type] || transformAgentType(agent.type);

      return getParams(arrItem, type);
    })
  );
};

const getServiceModel = (item: Partial<ServicesList>) => {
  const createParams = getModel(item);

  return orderBy(
    ([] as Model[]).concat(...createParams),
    [(service: Model) => (service.service_name || '').toLowerCase()],
    ['asc']
  );
};

const getNodeModel = (item: InventoryList) => {
  const createParams = getModel(item);

  return orderBy(
    ([] as Model[]).concat(...createParams),
    [(node: Model) => (node.node_name || '').toLowerCase()],
    ['asc']
  );
};

const getAgentModel = (item: InventoryList) => {
  const createParams = getModel(item);

  return orderBy(
    ([] as Model[]).concat(...createParams),
    [(agent: Model) => (agent.type || '').toLowerCase()],
    ['asc']
  );
};

export const InventoryDataService = {
  getServiceModel,
  getAgentModel,
  getNodeModel,
};
