import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

import { DerivedFields } from './DerivedFields';

describe('DerivedFields', () => {
  let originalGetSelection: typeof window.getSelection;
  beforeAll(() => {
    originalGetSelection = window.getSelection;
    window.getSelection = () => null;
  });

  afterAll(() => {
    window.getSelection = originalGetSelection;
  });

  it('renders correctly when no fields', () => {
    render(<DerivedFields onChange={() => {}} />);

    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.queryByText(/example log message/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('derived-field')).not.toBeInTheDocument();
  });

  it('renders correctly when there are fields', async () => {
    render(<DerivedFields value={testValue} onChange={() => {}} />);

    await waitFor(() => expect(screen.getAllByTestId('derived-field')).toHaveLength(2));
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Show example log message')).toBeInTheDocument();
  });

  it('adds a new field', async () => {
    const onChange = jest.fn();
    render(<DerivedFields onChange={onChange} />);

    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('removes a field', async () => {
    const onChange = jest.fn();
    render(<DerivedFields value={testValue} onChange={onChange} />);

    fireEvent.click((await screen.findAllByTitle('Remove field'))[0]);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([testValue[1]]));
  });
});

const testValue = [
  {
    matcherRegex: 'regex1',
    name: 'test1',
    url: 'localhost1',
  },
  {
    matcherRegex: 'regex2',
    name: 'test2',
    url: 'localhost2',
  },
];
