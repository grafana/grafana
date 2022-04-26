import NativeSearch from './NativeSearch';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { TempoDatasource, TempoQuery } from '../datasource';
import userEvent from '@testing-library/user-event';

const getOptions = jest.fn().mockImplementation(() => {
  return Promise.resolve([
    {
      value: 'customer',
      label: 'customer',
    },
    {
      value: 'driver',
      label: 'driver',
    },
  ]);
});

jest.mock('../language_provider', () => {
  return jest.fn().mockImplementation(() => {
    return { getOptions };
  });
});

const mockQuery = {
  refId: 'A',
  queryType: 'nativeSearch',
  key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
  serviceName: 'driver',
} as TempoQuery;

describe('NativeSearch', () => {
  it('should call the `onChange` function on click of the Input', async () => {
    const promise = Promise.resolve();
    const handleOnChange = jest.fn(() => promise);
    const fakeOptionChoice = {
      key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
      queryType: 'nativeSearch',
      refId: 'A',
      serviceName: 'driver',
      spanName: 'driver',
    };

    render(
      <NativeSearch
        datasource={{} as TempoDatasource}
        query={mockQuery}
        onChange={handleOnChange}
        onRunQuery={() => {}}
      />
    );

    const asyncServiceSelect = await screen.findByRole('combobox', { name: 'select-span-name' });

    expect(asyncServiceSelect).toBeInTheDocument();
    userEvent.click(asyncServiceSelect);

    const driverOption = await screen.findByText('driver');
    userEvent.click(driverOption);

    expect(handleOnChange).toHaveBeenCalledWith(fakeOptionChoice);
  });
});

describe('TempoLanguageProvider with delay', () => {
  const getOptions2 = jest.fn().mockImplementation(() => {
    return Promise.resolve([
      {
        value: 'customer',
        label: 'customer',
      },
      {
        value: 'driver',
        label: 'driver',
      },
    ]);
  });

  jest.mock('../language_provider', () => {
    return jest.fn().mockImplementation(() => {
      setTimeout(() => {
        return { getOptions2 };
      }, 3000);
    });
  });

  it('should show loader', async () => {
    const promise = Promise.resolve();
    const handleOnChange = jest.fn(() => promise);

    render(
      <NativeSearch
        datasource={{} as TempoDatasource}
        query={mockQuery}
        onChange={handleOnChange}
        onRunQuery={() => {}}
      />
    );

    const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-span-name' });

    userEvent.click(asyncServiceSelect);
    const loader = screen.getByText('Loading options...');

    expect(loader).toBeInTheDocument();
    await act(() => promise);
  });
});
