import { SelectableValue } from '@grafana/data';
import { Databases } from 'app/percona/shared/core';
import { BackupInventoryService } from '../BackupInventory.service';

export const RestoreBackupModalService = {
  async loadLocationOptions(artifactId: string) {
    const services = await BackupInventoryService.listCompatibleServices(artifactId);
    const result: Array<SelectableValue<string>> = [];

    Object.keys(services).forEach((db: Databases) => {
      const serviceArr = services[db] || [];
      result.push(...serviceArr.map((service) => ({ label: service.name, value: service.id })));
    });

    return result;
  },
};
