import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { DataLinkConfig } from '../types';

import { DataLinks, Props } from './DataLinks';

const setup = (propOverrides?: Props) => {
  const props: Props = {
    value: [],
    onChange: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return render(<DataLinks {...props} />);
};

describe('DataLinks', () => {
  it('should render correctly with no fields', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Data links' }));
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('should render correctly when passed fields', () => {
    setup({ value: testValue, onChange: () => {} });

    expect(screen.getByText('localhost1')).toBeInTheDocument();
    expect(screen.getByText('localhost2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove field' })).toHaveLength(2);
    expect(screen.getAllByRole('checkbox', { name: 'Internal link' })).toHaveLength(2);

    jest.spyOn(console, 'error').mockImplementation();
  });

  it('should call onChange to add a new field when the add button is clicked', () => {
    const onChangeMock = jest.fn();
    setup({ onChange: onChangeMock });

    expect(onChangeMock).not.toHaveBeenCalled();
    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);
    expect(onChangeMock).toHaveBeenCalled();
  });

  it('should call onChange to remove a field when the remove button is clicked', () => {
    const onChangeMock = jest.fn();
    setup({ value: testValue, onChange: onChangeMock });

    expect(onChangeMock).not.toHaveBeenCalled();
    const removeButton = screen.getAllByRole('button', { name: 'Remove field' });
    fireEvent.click(removeButton[0]);
    expect(onChangeMock).toHaveBeenCalled();

    jest.spyOn(console, 'error').mockImplementation();
  });
});

const testValue: DataLinkConfig[] = [
  {
    field: 'regex1',
    url: 'localhost1',
  },
  {
    field: 'regex2',
    url: 'localhost2',
  },
];
