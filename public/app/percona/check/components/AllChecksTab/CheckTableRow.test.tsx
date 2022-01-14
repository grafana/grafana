import React from 'react';
import { ReactWrapper, mount } from 'enzyme';
import { CheckService } from 'app/percona/check/Check.service';
import { LoaderButton } from '@percona/platform-core';
import { CheckTableRow } from './CheckTableRow';
import { Messages } from './AllChecksTab.messages';
import { CheckDetails } from 'app/percona/check/types';

const originalConsoleError = jest.fn();

const runAllPromises = () => new Promise(setImmediate);

const TEST_CHECK: CheckDetails = {
  summary: 'Test',
  name: 'test',
  interval: 'FREQUENT',
  description: 'test description',
  disabled: false,
};

const TEST_CHECK_DISABLED: CheckDetails = {
  summary: 'Test disabled',
  name: 'test disabled',
  interval: 'RARE',
  description: 'test disabled description',
  disabled: true,
};

const fakeOnSuccess = jest.fn();

describe('CheckTableRow::', () => {
  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.resetAllMocks();
  });

  it('should render a check row correctly', () => {
    let wrapper: ReactWrapper<{}, {}, any> = mount(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />);

    let tdElements = wrapper.find('tr').find('td');

    expect(tdElements.at(0).text()).toBe('Test');
    expect(tdElements.at(1).text()).toBe('test description');
    expect(tdElements.at(3).text()).toBe('Frequent');
    expect(tdElements.at(4).text()).toBe(Messages.disable);
    expect(tdElements.at(4).find(LoaderButton)).toHaveLength(1);
    expect(tdElements.at(4).find(LoaderButton).prop('variant')).toBe('destructive');

    wrapper = mount(<CheckTableRow check={TEST_CHECK_DISABLED} onSuccess={fakeOnSuccess} />);
    tdElements = wrapper.find('tr').find('td');

    expect(tdElements.at(2).text()).toBe(Messages.disabled);
    expect(tdElements.at(3).text()).toBe('Rare');
    expect(tdElements.at(4).text()).toBe(Messages.enable);
    expect(tdElements.at(4).find(LoaderButton).prop('variant')).toBe('primary');

    wrapper.unmount();
  });

  it('should call an API to change the check status when the action button gets clicked', async () => {
    const spy = jest.spyOn(CheckService, 'changeCheck');
    let wrapper: ReactWrapper<{}, {}, any> = mount(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />);

    expect(spy).toBeCalledTimes(0);

    wrapper.find(LoaderButton).simulate('click');

    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith({ params: [{ name: TEST_CHECK.name, disable: true }] });

    wrapper = mount(<CheckTableRow check={TEST_CHECK_DISABLED} onSuccess={fakeOnSuccess} />);

    wrapper.find(LoaderButton).simulate('click');

    expect(spy).toBeCalledTimes(2);
    expect(spy).toBeCalledWith({ params: [{ name: TEST_CHECK_DISABLED.name, enable: true }] });

    spy.mockClear();
    wrapper.unmount();
  });

  it('should call the onSuccess callback after the change API succeeds', async () => {
    const spy = jest.spyOn(CheckService, 'changeCheck');
    const wrapper: ReactWrapper<{}, {}, any> = mount(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />);

    expect(fakeOnSuccess).toBeCalledTimes(0);

    wrapper.find(LoaderButton).simulate('click');

    await runAllPromises();
    wrapper.update();

    expect(fakeOnSuccess).toBeCalledTimes(1);

    spy.mockClear();
    wrapper.unmount();
  });

  it('should log an error if the API call fails', () => {
    const spy = jest.spyOn(CheckService, 'changeCheck').mockImplementation(() => {
      throw Error('test');
    });

    const wrapper: ReactWrapper<{}, {}, any> = mount(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />);

    wrapper.find(LoaderButton).simulate('click');

    expect(console.error).toBeCalledTimes(1);

    spy.mockClear();
    wrapper.unmount();
  });
});
