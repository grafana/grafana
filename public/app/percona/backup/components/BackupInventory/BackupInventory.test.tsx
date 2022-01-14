import React from 'react';

import { Table } from 'app/percona/integrated-alerting/components/Table';
import { getMount } from 'app/percona/shared/helpers/testUtils';

import { BackupInventory } from './BackupInventory';
import { Backup } from './BackupInventory.types';
import { stubs } from './__mocks__/BackupInventory.service';

jest.mock('./BackupInventory.service');
jest.mock('../../hooks/recurringCall.hook');

describe('BackupInventory', () => {
  it('should send correct data to Table', async () => {
    const wrapper = await getMount(<BackupInventory />);

    wrapper.update();
    expect(wrapper.find(Table).prop('data')).toEqual<Backup[]>(stubs);
  });
});
