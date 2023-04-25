import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataLinkConfig } from '../types';

import { DataLinks, Props } from './DataLinks';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    links: [],
    onChange: jest.fn(),
    ...propOverrides,
  };

  return render(<DataLinks {...props} />);
};

describe('DataLinks tests', () => {
  it('should render correctly with no fields', async () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Data links' }));
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(await screen.findAllByRole('button')).toHaveLength(1);
  });

  it('should render correctly when passed fields', async () => {
    setup({ links: testLinks });

    expect(await screen.findAllByRole('button', { name: 'Remove field' })).toHaveLength(2);
    expect(await screen.findAllByRole('checkbox', { name: 'Internal link' })).toHaveLength(2);
  });

  it('should call onChange to add a new field when the add button is clicked', async () => {
    const onChangeMock = jest.fn();
    setup({ onChange: onChangeMock });

    expect(onChangeMock).not.toHaveBeenCalled();
    const addButton = screen.getByRole('button', { name: 'Add' });
    await userEvent.click(addButton);

    expect(onChangeMock).toHaveBeenCalled();
  });

  it('should call onChange to remove a field when the remove button is clicked', async () => {
    const onChangeMock = jest.fn();
    setup({ links: testLinks, onChange: onChangeMock });

    expect(onChangeMock).not.toHaveBeenCalled();
    const removeButton = await screen.findAllByRole('button', { name: 'Remove field' });
    await userEvent.click(removeButton[0]);

    expect(onChangeMock).toHaveBeenCalled();
  });

  it('should validate duplicated data links', async () => {
    const duplicatedLinks = [
      {
        field: 'regex1',
        url: '',
      },
      {
        field: 'regex1',
        url: '',
      },
    ];

    setup({ links: duplicatedLinks });

    userEvent.click(screen.getAllByPlaceholderText('Field name or regex pattern')[0]);

    expect(await screen.findByText('Field already in use')).toBeInTheDocument();
  });

  it('should not validate empty data links as duplicated', () => {
    const duplicatedLinks = [
      {
        field: '',
        url: '',
      },
      {
        field: '',
        url: '',
      },
    ];

    setup({ links: duplicatedLinks });

    userEvent.click(screen.getAllByPlaceholderText('Field name or regex pattern')[0]);

    expect(screen.queryByText('Field already in use')).not.toBeInTheDocument();
  });
});

const testLinks: DataLinkConfig[] = [
  {
    field: 'regex1',
    url: 'localhost1',
  },
  {
    field: 'regex2',
    url: 'localhost2',
  },
];
