import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { FetchError } from '@grafana/runtime';

import { EditableTitle } from './EditableTitle';

describe('EditableTitle', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const value = 'Test';

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockEdit = jest.fn().mockImplementation((newValue: string) => Promise.resolve(newValue));

  it('displays the provided text correctly', () => {
    render(<EditableTitle value={value} onEdit={mockEdit} />);
    expect(screen.getByRole('heading', { name: value })).toBeInTheDocument();
  });

  it('displays an edit button', () => {
    render(<EditableTitle value={value} onEdit={mockEdit} />);
    expect(screen.getByRole('button', { name: 'Edit title' })).toBeInTheDocument();
  });

  it('clicking the edit button changes the text to an input and autofocuses', async () => {
    render(<EditableTitle value={value} onEdit={mockEdit} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    const editButton = screen.getByRole('button', { name: 'Edit title' });
    await user.click(editButton);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit title' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('blurring the input calls the onEdit callback and reverts back to text', async () => {
    render(<EditableTitle value={value} onEdit={mockEdit} />);

    const editButton = screen.getByRole('button', { name: 'Edit title' });
    await user.click(editButton);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New value');

    await user.click(document.body);
    expect(mockEdit).toHaveBeenCalledWith('New value');
    act(() => {
      jest.runAllTimers();
    });
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByRole('heading')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit title' })).toBeInTheDocument();
    });
  });

  it('pressing enter calls the onEdit callback and reverts back to text', async () => {
    render(<EditableTitle value={value} onEdit={mockEdit} />);

    const editButton = screen.getByRole('button', { name: 'Edit title' });
    await user.click(editButton);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New value');

    await user.keyboard('{enter}');
    expect(mockEdit).toHaveBeenCalledWith('New value');
    act(() => {
      jest.runAllTimers();
    });
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByRole('heading')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit title' })).toBeInTheDocument();
    });
  });

  it('displays an error message when attempting to save an empty value', async () => {
    render(<EditableTitle value={value} onEdit={mockEdit} />);

    const editButton = screen.getByRole('button', { name: 'Edit title' });
    await user.click(editButton);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.keyboard('{enter}');

    expect(screen.getByText('Please enter a title')).toBeInTheDocument();
  });

  it('displays a regular error message', async () => {
    const mockEditError = jest.fn().mockImplementation(() => {
      throw new Error('Uh oh spaghettios');
    });
    render(<EditableTitle value={value} onEdit={mockEditError} />);

    const editButton = screen.getByRole('button', { name: 'Edit title' });
    await user.click(editButton);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New value');

    await user.keyboard('{enter}');
    expect(screen.getByText('Uh oh spaghettios')).toBeInTheDocument();
  });

  it('displays a detailed fetch error message', async () => {
    const mockEditError = jest.fn().mockImplementation(() => {
      const fetchError: FetchError = {
        status: 500,
        config: {
          url: '',
        },
        data: {
          message: 'Uh oh spaghettios a fetch error',
        },
      };
      throw fetchError;
    });
    render(<EditableTitle value={value} onEdit={mockEditError} />);

    const editButton = screen.getByRole('button', { name: 'Edit title' });
    await user.click(editButton);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New value');

    await user.keyboard('{enter}');
    expect(screen.getByText('Uh oh spaghettios a fetch error')).toBeInTheDocument();
  });
});
