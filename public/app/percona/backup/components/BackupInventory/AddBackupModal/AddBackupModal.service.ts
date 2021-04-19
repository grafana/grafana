import { SelectableValue } from '@grafana/data';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { Databases } from 'app/percona/shared/core';
import { StorageLocationsService } from '../../StorageLocations/StorageLocations.service';
import { SelectableService } from './AddBackupModal.types';

export const AddBackupModalService = {
  async loadServiceOptions(): Promise<Array<SelectableValue<SelectableService>>> {
    const supportedServices: Databases[] = [Databases.mysql, Databases.mongodb];
    const services = await InventoryService.getDbServices();

    return Object.keys(services).reduce((acc, serviceName: Databases) => {
      const newServices = services[serviceName] ?? [];

      if (supportedServices.includes(serviceName)) {
        return [
          ...acc,
          ...newServices.map(
            ({ id, name }): SelectableValue<SelectableService> => ({
              label: name,
              value: { id, vendor: serviceName },
            })
          ),
        ];
      }

      return acc;
    }, [] as Array<SelectableValue<SelectableService>>);
  },
  async loadLocationOptions(): Promise<Array<SelectableValue<string>>> {
    const { locations = [] } = await StorageLocationsService.list();

    return locations.map(({ location_id, name }): SelectableValue<string> => ({ label: name, value: location_id }));
  },
};
