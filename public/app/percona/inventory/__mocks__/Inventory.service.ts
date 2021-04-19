import * as service from '../Inventory.service';
import { DBServiceList } from '../Inventory.types';

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

export const InventoryService = jest.genMockFromModule<typeof service>('../InventoryService.service').InventoryService;
InventoryService.getDbServices = () => Promise.resolve(stubs);
