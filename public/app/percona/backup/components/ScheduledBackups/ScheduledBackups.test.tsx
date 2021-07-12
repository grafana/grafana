import React from 'react';
import { getMount } from 'app/percona/shared/helpers/testUtils';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { stubs } from './__mocks__/ScheduledBackups.service';
import { ScheduledBackups } from './ScheduledBackups';
import { ScheduledBackup } from './ScheduledBackups.types';

jest.mock('./ScheduledBackups.service');

describe('ScheduledBackups', () => {
  it('should send correct data to Table', async () => {
    const wrapper = await getMount(<ScheduledBackups />);
    wrapper.update();
    expect(wrapper.find(Table).prop('data')).toEqual<ScheduledBackup[]>(stubs);
  });
});
