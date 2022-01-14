import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { Backup } from './BackupInventory.types';
import { stubs } from './__mocks__/BackupInventory.service';
import { BackupInventory } from './BackupInventory';

jest.mock('./BackupInventory.service');

describe('BackupInventory', () => {
  it('should send correct data to Table', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = await mount(<BackupInventory />);
    });

    wrapper.update();
    expect(wrapper.find(Table).prop('data')).toEqual<Backup[]>(stubs);
  });
});
