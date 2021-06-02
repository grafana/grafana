import React from 'react';
import { logger, dataQa } from '@percona/platform-core';
import { CheckService } from 'app/percona/check/Check.service';
import { getMount } from 'app/percona/shared/helpers/testUtils';
import { Interval } from 'app/percona/check/types';
import { AllChecksTab } from './AllChecksTab';
import { Messages } from './AllChecksTab.messages';
import { Spinner } from '@grafana/ui';

const runAllPromises = () => new Promise(setImmediate);

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
    const wrapper = await getMount(<AllChecksTab />);
    wrapper.update();

    expect(spy).toBeCalledTimes(1);

    spy.mockClear();
    wrapper.unmount();
  });

  it('should render a spinner at startup, while loading', async () => {
    const wrapper = await getMount(<AllChecksTab />);
    wrapper.update();

    await runAllPromises();

    wrapper.update();

    expect(wrapper.find(<Spinner />)).toHaveLength(0);

    wrapper.unmount();
  });

  it('should log an error if the API call fails', async () => {
    const spy = jest.spyOn(CheckService, 'getAllChecks').mockImplementation(() => {
      throw Error('test');
    });
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementationOnce(() => null);

    const wrapper = await getMount(<AllChecksTab />);
    wrapper.update();

    expect(loggerSpy).toBeCalledTimes(1);

    spy.mockClear();
    wrapper.unmount();
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

    const wrapper = await getMount(<AllChecksTab />);
    wrapper.update();

    await runAllPromises();

    wrapper.update();

    const tbody = dataQa('db-checks-all-checks-tbody');

    expect(wrapper.find(dataQa('db-checks-all-checks-table'))).toHaveLength(1);
    expect(wrapper.find(dataQa('db-checks-all-checks-thead'))).toHaveLength(1);
    expect(wrapper.find(tbody)).toHaveLength(1);
    expect(wrapper.find(tbody).find('tr > td')).toHaveLength(10);
    expect(wrapper.find(tbody).find('tr > td').at(0).text()).toBe('Test');
    expect(wrapper.find(tbody).find('tr > td').at(1).text()).toBe('test enabled description');
    expect(wrapper.find(tbody).find('tr > td').at(2).text()).toBe(Messages.enabled);
    expect(wrapper.find(tbody).find('tr > td').at(3).text()).toBe(Interval.STANDARD);
    expect(wrapper.find(tbody).find('tr > td').at(4).text()).toBe(Messages.disable);
    expect(wrapper.find(tbody).find('tr > td').at(5).text()).toBe('Test disabled');
    expect(wrapper.find(tbody).find('tr > td').at(6).text()).toBe('test disabled description');
    expect(wrapper.find(tbody).find('tr > td').at(7).text()).toBe(Messages.disabled);
    expect(wrapper.find(tbody).find('tr > td').at(8).text()).toBe(Interval.RARE);
    expect(wrapper.find(tbody).find('tr > td').at(9).text()).toBe(Messages.enable);

    wrapper.unmount();
  });
});
