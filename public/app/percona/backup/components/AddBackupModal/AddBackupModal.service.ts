import { SelectableValue } from '@grafana/data';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { Databases } from 'app/percona/shared/core';
import { StorageLocationsService } from '../StorageLocations/StorageLocations.service';
import { SelectableService } from './AddBackupModal.types';

export const AddBackupModalService = {
  async loadServiceOptions(): Promise<Array<SelectableValue<SelectableService>>> {
    const supportedServices: Databases[] = [Databases.mysql, Databases.mongodb];
    const services = await InventoryService.getDbServices();
    const result: Array<SelectableValue<SelectableService>> = [];

    Object.keys(services).forEach((serviceName) => {
      const newServices = services[serviceName as Databases] ?? [];

      if (supportedServices.includes(serviceName as Databases)) {
        result.push(
          ...newServices.map(
            ({ id, name }): SelectableValue<SelectableService> => ({
              label: name,
              value: { id, vendor: serviceName as Databases },
            })
          )
        );
      }
    });

    return result;
  },
  async loadLocationOptions(): Promise<Array<SelectableValue<string>>> {
    const { locations = [] } = await StorageLocationsService.list();

    return locations.map(({ location_id, name }): SelectableValue<string> => ({ label: name, value: location_id }));
  },
};
