import React from 'react';
import { mount } from 'enzyme';
import { useRecurringCall } from './recurringCall.hook';

let fakeCallback: jest.Mock;
const runAllPromises = () => new Promise(resolve => setImmediate(resolve));
const TIMEOUT_TIME = 5000;
const CHANGED_TIMEOUT_TIME = 20000;

const Dummy = () => {
  const [triggerTimeout, changeInterval, stopTimeout] = useRecurringCall();

  return (
    <>
      <button onClick={() => triggerTimeout(fakeCallback, TIMEOUT_TIME, true)}></button>
      <button onClick={() => stopTimeout()}></button>
      <button onClick={() => changeInterval(CHANGED_TIMEOUT_TIME)}></button>
    </>
  );
};

const originalPlatformCore = jest.requireActual('@percona/platform-core');
jest.mock('@percona/platform-core', () => ({
  ...originalPlatformCore,
  logger: {
    error: jest.fn(),
  },
}));

describe('useRecurringCall', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fakeCallback = jest.fn();
  });

  it('should invoke the callback immediately if flag passed', async () => {
    const wrapper = mount(<Dummy />);
    wrapper
      .find('button')
      .first()
      .simulate('click');
    await runAllPromises();
    expect(fakeCallback).toHaveBeenCalledTimes(1);
  });

  it('should invoke the callback recursively', async () => {
    const wrapper = mount(<Dummy />);
    wrapper
      .find('button')
      .first()
      .simulate('click');
    await runAllPromises();

    jest.advanceTimersByTime(5000);
    await runAllPromises();

    jest.advanceTimersByTime(5000);
    await runAllPromises();

    jest.advanceTimersByTime(5000);
    await runAllPromises();
    expect(fakeCallback).toHaveBeenCalledTimes(4);
  });

  it('should clear timeout on unmount', async () => {
    const wrapper = mount(<Dummy />);
    wrapper
      .find('button')
      .first()
      .simulate('click');
    await runAllPromises();
    expect(clearTimeout).not.toHaveBeenCalled();
    wrapper.unmount();

    expect(clearTimeout).toHaveBeenCalled();
  });

  it('should keep timeout on error', async () => {
    fakeCallback.mockImplementationOnce(() => {
      throw new Error();
    });
    const wrapper = mount(<Dummy />);
    wrapper
      .find('button')
      .first()
      .simulate('click');
    await runAllPromises();

    jest.advanceTimersByTime(5000);
    await runAllPromises();

    jest.advanceTimersByTime(5000);
    await runAllPromises();

    jest.advanceTimersByTime(5000);
    await runAllPromises();
    expect(fakeCallback).toHaveBeenCalledTimes(4);
  });

  it('should stop timeout flow', async () => {
    const wrapper = mount(<Dummy />);
    wrapper
      .find('button')
      .first()
      .simulate('click');
    await runAllPromises();

    wrapper
      .find('button')
      .at(1)
      .simulate('click');

    jest.advanceTimersByTime(5000);
    await runAllPromises();

    expect(fakeCallback).toHaveBeenCalledTimes(1);
  });

  it('should change interval', async () => {
    const wrapper = mount(<Dummy />);
    wrapper
      .find('button')
      .first()
      .simulate('click');
    await runAllPromises();
    expect(fakeCallback).toHaveBeenCalledTimes(1);

    wrapper
      .find('button')
      .at(2)
      .simulate('click');

    jest.advanceTimersByTime(5000);
    await runAllPromises();

    jest.advanceTimersByTime(5000);
    await runAllPromises();

    jest.advanceTimersByTime(5000);
    await runAllPromises();

    expect(fakeCallback).toHaveBeenCalledTimes(2);
  });
});
