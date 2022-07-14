import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { IndeterminateCheckbox } from './IndeterminateCheckbox';
import { makeData, ReactTable } from './IndeterminateCheckbox.story';

describe('IndeterminateCheckbox', () => {
  it('displays the checkbox', () => {
    render(<IndeterminateCheckbox />);
    const checkbox = screen.getByRole('checkbox');

    expect(checkbox).toBeInTheDocument();
  });
});

describe('IndeterminateCheckbox', () => {
  beforeEach(() => {
    const columns = () => [
      {
        Header: 'First Name',
        accessor: 'firstName',
      },
      {
        Header: 'Age',
        accessor: 'age',
      },
      {
        Header: 'Visits',
        accessor: 'visits',
      },
    ];
    const data = () => makeData(5);
    render(<ReactTable columns={columns()} data={data()} />);
  });
  it('toggles between indeterminate and not-indeterminate if 1 or more non-select-all checkboxes, but not all, are checked', () => {
    const checkbox = screen.getAllByRole('checkbox') as HTMLInputElement[];

    // 1 or more non-select-all checkboxes in table are checked
    fireEvent.click(checkbox[1]);

    expect(checkbox[1].checked).toBe(true);
    expect(screen.getByTestId('indeterminate')).toBeInTheDocument();

    // same box is checked again
    fireEvent.click(checkbox[1]);
    expect(checkbox[1].checked).toBe(false);
    expect(screen.queryByTestId('indeterminate')).not.toBeInTheDocument();
  });

  it('toggles between checked and unchecked if select-all checkbox is clicked directly', () => {
    const checkbox = screen.getAllByRole('checkbox') as HTMLInputElement[];

    // select-all checkbox is clicked directly
    fireEvent.click(checkbox[0]);

    expect(checkbox[0].checked).toBe(true);
    expect(screen.queryByTestId('indeterminate')).not.toBeInTheDocument();

    // select-all checkbox is clicked directly again to toggle checked
    fireEvent.click(checkbox[0]);
    expect(checkbox[0].checked).toBe(false);
  });

  it('toggles between indeterminate and checked if, first, not all and then all non-select-all checkboxes are checked, without select-all being clicked directly', () => {
    const checkbox = screen.getAllByRole('checkbox') as HTMLInputElement[];

    fireEvent.click(checkbox[1]);
    fireEvent.click(checkbox[2]);
    fireEvent.click(checkbox[3]);
    fireEvent.click(checkbox[4]);

    expect(checkbox[0].checked).toBe(false);
    expect(screen.queryByTestId('indeterminate')).toBeInTheDocument();

    // last item is selected, so then indeterminate should switch to checked
    fireEvent.click(checkbox[5]);
    expect(checkbox[0].checked).toBe(true);
    expect(screen.queryByTestId('indeterminate')).not.toBeInTheDocument();
  });
});
