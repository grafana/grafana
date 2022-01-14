import { SelectableValue } from '@grafana/data';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { Databases } from 'app/percona/shared/core';

import { AddBackupModalService } from './AddBackupModal.service';
import { SelectableService } from './AddBackupModal.types';

describe('AddBackupModalService', () => {
  it('should return only supported services', async () => {
    jest.spyOn(InventoryService, 'getDbServices').mockReturnValueOnce(
      Promise.resolve({
        postgresql: [{ id: 'psql1', name: 'postgres one' }],
        mongodb: [
          { id: 'mongo1', name: 'mongo one' },
          { id: 'mongo2', name: 'mongo two' },
        ],
        mysql: [{ id: 'mysql1', name: 'mysql one' }],
        proxysql: [{ id: 'proxysql1', name: 'proxysql one' }],
      })
    );
    const services = await AddBackupModalService.loadServiceOptions();
    const orderFn = (s1: SelectableValue<SelectableService>, s2: SelectableValue<SelectableService>) =>
      s1.label?.localeCompare(s2.label ?? '') ?? 0;

    expect(services.sort(orderFn)).toEqual<Array<SelectableValue<SelectableService>>>(
      [
        { label: 'mysql one', value: { id: 'mysql1', vendor: Databases.mysql } },
        { label: 'mongo one', value: { id: 'mongo1', vendor: Databases.mongodb } },
        { label: 'mongo two', value: { id: 'mongo2', vendor: Databases.mongodb } },
      ].sort(orderFn)
    );
  });
});
