import React from 'react';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { BackupInventory } from './BackupInventory';
import { render, waitFor } from '@testing-library/react';
import { stubs } from './__mocks__/BackupInventory.service';

jest.mock('./BackupInventory.service');
jest.mock('../../hooks/recurringCall.hook');
jest.mock('app/percona/integrated-alerting/components/Table', () => ({
  Table: jest.fn(({ children }) => <div data-testid="table">{children}</div>),
}));

describe('BackupInventory', () => {
  it('should send correct data to Table', async () => {
    await waitFor(() => render(<BackupInventory />));

    expect(Table).toHaveBeenCalledWith(expect.objectContaining({ data: stubs }), expect.anything());
  });
});
