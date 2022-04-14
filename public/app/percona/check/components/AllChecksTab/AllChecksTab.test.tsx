import React from 'react';
import { logger } from '@percona/platform-core';
import { CheckService } from 'app/percona/check/Check.service';
import { Interval } from 'app/percona/check/types';
import { AllChecksTab } from './AllChecksTab';
import { Messages } from './AllChecksTab.messages';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('AllChecksTab::', () => {
  it('should fetch checks at startup', async () => {
    const spy = jest.spyOn(CheckService, 'getAllChecks');
    render(<AllChecksTab />);

    expect(spy).toBeCalledTimes(1);

    spy.mockClear();
  });

  it('should render a spinner at startup, while loading', async () => {
    const spy = jest.spyOn(CheckService, 'getAllChecks').mockImplementation(() =>
      Promise.resolve([
        {
          summary: 'Test',
          name: 'test enabled',
          description: 'test enabled description',
          interval: 'STANDARD',
          disabled: false,
        },
      ])
    );
    const component = render(<AllChecksTab />);
    expect(screen.queryByTestId('spinner-wrapper')).toBeInTheDocument();
    await waitFor(() => component);
    expect(screen.queryByTestId('spinner-wrapper')).not.toBeInTheDocument();
    spy.mockClear();
  });

  it('should log an error if the API call fails', async () => {
    const spy = jest.spyOn(CheckService, 'getAllChecks').mockImplementation(() => {
      throw Error('test');
    });
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementationOnce(() => null);

    await waitFor(() => render(<AllChecksTab />));

    expect(loggerSpy).toBeCalledTimes(1);

    spy.mockClear();
  });

  it('should render a table', async () => {
    jest.spyOn(CheckService, 'getAllChecks').mockImplementation(() =>
      Promise.resolve([
        {
          summary: 'Test',
          name: 'test enabled',
          description: 'test enabled description',
          interval: 'STANDARD',
          disabled: false,
        },
        {
          summary: 'Test disabled',
          name: 'test disabled',
          description: 'test disabled description',
          interval: 'RARE',
          disabled: true,
        },
      ])
    );

    await waitFor(() => render(<AllChecksTab />));

    const tbody = screen.getByTestId('db-checks-all-checks-tbody');

    expect(screen.getByTestId('db-checks-all-checks-table')).toBeInTheDocument();
    expect(screen.getByTestId('db-checks-all-checks-thead')).toBeInTheDocument();
    expect(screen.getByTestId('db-checks-all-checks-tbody')).toBeInTheDocument();
    expect(tbody.querySelectorAll('tr > td')).toHaveLength(10);
    expect(tbody.querySelectorAll('tr > td')[0]).toHaveTextContent('Test');
    expect(tbody.querySelectorAll('tr > td')[1]).toHaveTextContent('test enabled description');
    expect(tbody.querySelectorAll('tr > td')[2]).toHaveTextContent(Messages.enabled);
    expect(tbody.querySelectorAll('tr > td')[3]).toHaveTextContent(Interval.STANDARD);
    expect(tbody.querySelectorAll('tr > td')[4]).toHaveTextContent(Messages.disable);
    expect(tbody.querySelectorAll('tr > td')[5]).toHaveTextContent('Test disabled');
    expect(tbody.querySelectorAll('tr > td')[6]).toHaveTextContent('test disabled description');
    expect(tbody.querySelectorAll('tr > td')[7]).toHaveTextContent(Messages.disabled);
    expect(tbody.querySelectorAll('tr > td')[8]).toHaveTextContent(Interval.RARE);
    expect(tbody.querySelectorAll('tr > td')[9]).toHaveTextContent(Messages.enable);
  });
});
