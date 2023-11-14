/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { SelectableValue } from '@grafana/data';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { Databases } from 'app/percona/shared/core';

import { SelectableService } from './AddBackupPage.types';

export const AddBackupPageService = {
  async loadServiceOptions(query: string): Promise<Array<SelectableValue<SelectableService>>> {
    const supportedServices: Databases[] = [Databases.mysql, Databases.mongodb];
    const services = await InventoryService.getDbServices();
    const result: Array<SelectableValue<SelectableService>> = [];

    // @ts-ignore
    Object.keys(services).forEach((serviceName: Databases) => {
      const newServices = services[serviceName] ?? [];

      if (supportedServices.includes(serviceName.toLowerCase())) {
        result.push(
          ...newServices
            .filter((service) => service.name.toLowerCase().includes(query.toLowerCase()))
            .map(
              ({ id, name, cluster }): SelectableValue<SelectableService> => ({
                label: name,
                value: { id, vendor: serviceName, cluster },
              })
            )
        );
      }
    });

    return result;
  },
};
