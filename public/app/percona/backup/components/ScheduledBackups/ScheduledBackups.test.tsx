import React from 'react';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { stubs } from './__mocks__/ScheduledBackups.service';
import { ScheduledBackups } from './ScheduledBackups';
import { render, waitFor } from '@testing-library/react';

jest.mock('./ScheduledBackups.service');
jest.mock('app/percona/integrated-alerting/components/Table', () => ({
  Table: jest.fn(({ children }) => <div data-testid="table">{children}</div>),
}));

describe('ScheduledBackups', () => {
  it('should send correct data to Table', async () => {
    await waitFor(() => render(<ScheduledBackups />));
    expect(Table).toHaveBeenCalledWith(expect.objectContaining({ data: stubs }), expect.anything());
  });
});
