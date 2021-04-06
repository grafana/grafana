import { SelectableValue } from '@grafana/data';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { Databases } from 'app/percona/shared/core';
import { StorageLocationsService } from '../../StorageLocations/StorageLocations.service';
import { SelectableService } from './AddBackupModal.types';

export const AddBackupModalService = {
  async loadServiceOptions(): Promise<Array<SelectableValue<SelectableService>>> {
    let result: Array<SelectableValue<SelectableService>> = [];
    const services = await InventoryService.getDbServices();

    // TODO remove this constraint when more DB types are supported
    if (services.mysql) {
      result = services.mysql.map(
        ({ id, name }): SelectableValue<SelectableService> => ({ label: name, value: { id, vendor: Databases.mysql } })
      );
    }

    return result;
  },
  async loadLocationOptions(): Promise<Array<SelectableValue<string>>> {
    const { locations = [] } = await StorageLocationsService.list();

    return locations.map(({ location_id, name }): SelectableValue<string> => ({ label: name, value: location_id }));
  },
};
