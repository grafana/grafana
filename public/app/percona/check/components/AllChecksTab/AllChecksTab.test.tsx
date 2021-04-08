import React from 'react';
import { ReactWrapper, mount } from 'enzyme';
import { CheckService } from 'app/percona/check/Check.service';
import { Interval } from 'app/percona/check/types';
import { AllChecksTab } from './AllChecksTab';
import { Messages } from './AllChecksTab.messages';

const originalConsoleError = console.error;

const dataQa = (label: string) => `[data-qa="${label}"]`;

const runAllPromises = () => new Promise(setImmediate);

describe('AllChecksTab::', () => {
  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.resetAllMocks();
  });

  it('should fetch checks at startup', () => {
    const spy = jest.spyOn(CheckService, 'getAllChecks');

    const wrapper: ReactWrapper<{}, {}, any> = mount(<AllChecksTab />);

    expect(spy).toBeCalledTimes(1);

    spy.mockClear();
    wrapper.unmount();
  });

  it('should render a spinner at startup, while loading', async () => {
    const wrapper: ReactWrapper<{}, {}, any> = mount(<AllChecksTab />);

    await runAllPromises();

    wrapper.update();

    expect(wrapper.find(dataQa('db-checks-all-checks-spinner'))).toHaveLength(0);

    wrapper.unmount();
  });

  it('should log an error if the API call fails', () => {
    const spy = jest.spyOn(CheckService, 'getAllChecks').mockImplementation(() => {
      throw Error('test');
    });

    const wrapper: ReactWrapper<{}, {}, any> = mount(<AllChecksTab />);

    expect(console.error).toBeCalledTimes(1);

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

    const wrapper: ReactWrapper<{}, {}, any> = mount(<AllChecksTab />);

    await runAllPromises();

    wrapper.update();

    const tbody = dataQa('db-checks-all-checks-tbody');

    expect(wrapper.find(dataQa('db-checks-all-checks-table'))).toHaveLength(1);
    expect(wrapper.find(dataQa('db-checks-all-checks-thead'))).toHaveLength(1);
    expect(wrapper.find(tbody)).toHaveLength(1);
    expect(wrapper.find(tbody).find('tr > td')).toHaveLength(10);
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(0)
        .text()
    ).toBe('Test');
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(1)
        .text()
    ).toBe('test enabled description');
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(2)
        .text()
    ).toBe(Messages.enabled);
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(3)
        .text()
    ).toBe(Interval.STANDARD);
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(4)
        .text()
    ).toBe(Messages.disable);
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(5)
        .text()
    ).toBe('Test disabled');
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(6)
        .text()
    ).toBe('test disabled description');
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(7)
        .text()
    ).toBe(Messages.disabled);
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(8)
        .text()
    ).toBe(Interval.RARE);
    expect(
      wrapper
        .find(tbody)
        .find('tr > td')
        .at(9)
        .text()
    ).toBe(Messages.enable);

    wrapper.unmount();
  });
});
