import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createMockResourcePickerRows } from '../../__mocks__/resourcePickerRows';
import NestedResourceTable from './NestedResourceTable';
import { findRow } from './utils';

describe('AzureMonitor NestedResourceTable', () => {
  const noop: any = () => {};

  const getElementById = document.getElementById;
  beforeEach(() => {
    document.getElementById = jest.fn().mockReturnValue({
      scrollIntoView: jest.fn(),
    });
  });
  afterEach(() => {
    document.getElementById = getElementById;
  });

  it('renders subscriptions', () => {
    const rows = createMockResourcePickerRows();

    render(<NestedResourceTable rows={rows} selectedRows={[]} requestNestedRows={noop} onRowSelectedChange={noop} />);

    expect(screen.getByText('Primary Subscription')).toBeInTheDocument();
    expect(screen.getByText('Dev Subscription')).toBeInTheDocument();
  });

  it('opens to the selected resource', () => {
    const rows = createMockResourcePickerRows();
    const selected = findRow(
      rows,
      '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/web-server_DataDisk'
    );

    if (!selected) {
      throw new Error("couldn't find row, test data stale");
    }

    render(
      <NestedResourceTable rows={rows} selectedRows={[selected]} requestNestedRows={noop} onRowSelectedChange={noop} />
    );

    expect(screen.getByText('web-server_DataDisk')).toBeInTheDocument();
  });

  it("expands resource groups when they're clicked", async () => {
    const rows = createMockResourcePickerRows();
    const promise = Promise.resolve();
    const requestNestedRows = jest.fn().mockReturnValue(promise);
    render(
      <NestedResourceTable
        rows={rows}
        selectedRows={[]}
        requestNestedRows={requestNestedRows}
        onRowSelectedChange={noop}
      />
    );

    const expandButton = screen.getAllByLabelText('Expand')[2];
    userEvent.click(expandButton);

    expect(requestNestedRows).toBeCalledWith(
      expect.objectContaining({
        id: '/subscriptions/def-456/resourceGroups/dev',
        name: 'Development',
        typeLabel: 'Resource Group',
      })
    );

    await act(() => promise);

    expect(screen.getByText('web-server')).toBeInTheDocument();
  });

  it('supports selecting variables', async () => {
    const rows = createMockResourcePickerRows();
    const promise = Promise.resolve();
    const requestNestedRows = jest.fn().mockReturnValue(promise);
    const onRowSelectedChange = jest.fn();
    render(
      <NestedResourceTable
        rows={rows}
        selectedRows={[]}
        requestNestedRows={requestNestedRows}
        onRowSelectedChange={onRowSelectedChange}
      />
    );

    const expandButton = screen.getAllByLabelText('Expand')[5];
    userEvent.click(expandButton);

    await act(() => promise);

    const checkbox = screen.getByLabelText('$workspace');
    userEvent.click(checkbox);

    expect(onRowSelectedChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '$workspace',
        name: '$workspace',
      }),
      true
    );
  });
});
