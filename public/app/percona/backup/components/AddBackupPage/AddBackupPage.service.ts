/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { SelectableValue } from '@grafana/data';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { Databases } from 'app/percona/shared/core';

import { SelectableService } from './AddBackupPage.types';

export const AddBackupPageService = {
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
};
