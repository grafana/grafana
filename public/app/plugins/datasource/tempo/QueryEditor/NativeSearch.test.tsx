import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { TempoDatasource } from '../datasource';
import { TempoQuery } from '../types';

import NativeSearch from './NativeSearch';

const getOptions = jest.fn().mockImplementation(() => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          value: 'customer',
          label: 'customer',
        },
        {
          value: 'driver',
          label: 'driver',
        },
      ]);
    }, 1000);
  });
});

jest.mock('../language_provider', () => {
  return jest.fn().mockImplementation(() => {
    return { getOptions };
  });
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: jest.fn(),
    containsTemplate: (val: string): boolean => {
      return val.includes('$');
    },
  }),
}));

let mockQuery = {
  refId: 'A',
  queryType: 'nativeSearch',
  key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
  serviceName: 'driver',
  spanName: 'customer',
} as TempoQuery;

describe('NativeSearch', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show loader when there is a delay', async () => {
    render(
      <NativeSearch datasource={{} as TempoDatasource} query={mockQuery} onChange={jest.fn()} onRunQuery={jest.fn()} />
    );

    const select = screen.getByRole('combobox', { name: 'select-service-name' });

    await user.click(select);
    const loader = screen.getByText('Loading options...');

    expect(loader).toBeInTheDocument();

    jest.advanceTimersByTime(1000);

    await waitFor(() => expect(screen.queryByText('Loading options...')).not.toBeInTheDocument());
  });

  it('should call the `onChange` function on click of the Input', async () => {
    const promise = Promise.resolve();
    const handleOnChange = jest.fn(() => promise);
    const fakeOptionChoice = {
      key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
      queryType: 'nativeSearch',
      refId: 'A',
      serviceName: 'driver',
      spanName: 'customer',
    };

    render(
      <NativeSearch
        datasource={{} as TempoDatasource}
        query={mockQuery}
        onChange={handleOnChange}
        onRunQuery={() => {}}
      />
    );

    const select = await screen.findByRole('combobox', { name: 'select-service-name' });

    expect(select).toBeInTheDocument();
    await user.click(select);
    jest.advanceTimersByTime(1000);

    await user.type(select, 'd');
    const driverOption = await screen.findByText('driver');
    await user.click(driverOption);

    expect(handleOnChange).toHaveBeenCalledWith(fakeOptionChoice);
  });

  it('should filter the span dropdown when user types a search value', async () => {
    render(
      <NativeSearch datasource={{} as TempoDatasource} query={mockQuery} onChange={() => {}} onRunQuery={() => {}} />
    );

    const select = await screen.findByRole('combobox', { name: 'select-service-name' });
    await user.click(select);
    jest.advanceTimersByTime(1000);
    expect(select).toBeInTheDocument();

    await user.type(select, 'd');
    let option = await screen.findByText('driver');
    expect(option).toBeDefined();

    await user.type(select, 'a');
    option = await screen.findByText('Hit enter to add');
    expect(option).toBeDefined();
  });

  it('should add variable to select menu options', async () => {
    mockQuery = {
      ...mockQuery,
      refId: '121314',
      serviceName: '$service',
      spanName: '$span',
    };

    render(
      <NativeSearch datasource={{} as TempoDatasource} query={mockQuery} onChange={() => {}} onRunQuery={() => {}} />
    );

    const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-service-name' });
    expect(asyncServiceSelect).toBeInTheDocument();
    await user.click(asyncServiceSelect);
    jest.advanceTimersByTime(3000);

    await user.type(asyncServiceSelect, '$');
    const serviceOption = await screen.findByText('$service');
    expect(serviceOption).toBeDefined();

    const asyncSpanSelect = screen.getByRole('combobox', { name: 'select-span-name' });
    expect(asyncSpanSelect).toBeInTheDocument();
    await user.click(asyncSpanSelect);
    jest.advanceTimersByTime(3000);

    await user.type(asyncSpanSelect, '$');
    const operationOption = await screen.findByText('$span');
    expect(operationOption).toBeDefined();
  });
});
