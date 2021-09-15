import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManualEntryEditor, Props } from './ManualEntryEditor';
import { defaultQuery } from '../constants';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockOnChange = jest.fn();
const setup = (testProps?: Partial<Props>) => {
  const props = {
    onRunQuery: jest.fn(),
    query: defaultQuery,
    onChange: mockOnChange,
    ...testProps,
  };

  return render(<ManualEntryEditor {...props} />);
};

describe('ManualEntryEditor', () => {
  it('should render', () => {
    setup();

    expect(screen.getByLabelText(/New value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument();
    expect(screen.getByText(/select point/i)).toBeInTheDocument();
  });

  it('should add new point', async () => {
    setup();

    userEvent.type(screen.getByLabelText(/New value/i), '10');
    userEvent.clear(screen.getByLabelText(/Time/i));
    userEvent.type(screen.getByLabelText(/Time/i), '2020-11-01T14:19:30+00:00');
    userEvent.click(screen.getByRole('button', { name: /Add/i }));

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ points: [[10, 1604240370000]] }));
    });
  });

  it('should list selected points and delete selected ones', async () => {
    const editor = setup({
      query: {
        ...defaultQuery,
        points: [
          [10, 1604240370000],
          [15, 1604340370000],
        ],
      },
    });
    let select = screen.getByText('All values').nextSibling!;
    await fireEvent.keyDown(select, { keyCode: 40 });
    const points = screen.getAllByLabelText('Select option');
    expect(points).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await userEvent.click(points[0]);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ points: [[15, 1604340370000]] }));
    });

    editor.rerender(
      <ManualEntryEditor
        query={{
          ...defaultQuery,
          points: [[15, 1604340370000]],
        }}
        onChange={jest.fn()}
        onRunQuery={jest.fn()}
      />
    );

    select = screen.getByText('All values').nextSibling!;
    await fireEvent.keyDown(select, { keyCode: 40 });
    expect(screen.getAllByLabelText('Select option')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
