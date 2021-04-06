import * as service from '../Inventory.service';
import { ServiceList } from '../Inventory.types';

export const stubs: ServiceList = {
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

export const InventoryService = jest.genMockFromModule<typeof service>('../InventoryService.service').InventoryService;
InventoryService.getServices = () => Promise.resolve(stubs);
