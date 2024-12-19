import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { useRecurringCall } from './recurringCall.hook';

let fakeCallback: jest.Mock;
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

jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('useRecurringCall', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fakeCallback = jest.fn();
  });

  it('should invoke the callback immediately if flag passed', async () => {
    render(<Dummy />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    await Promise.resolve();
    expect(fakeCallback).toHaveBeenCalledTimes(1);
  });

  it('should invoke the callback recursively', async () => {
    render(<Dummy />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(fakeCallback).toHaveBeenCalledTimes(4);
  });

  it('should clear timeout on unmount', async () => {
    const spy = jest.spyOn(window, 'clearTimeout').mockImplementationOnce((args) => clearTimeout(args));
    const wrapper = render(<Dummy />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    wrapper.unmount();

    expect(spy).toHaveBeenCalled();
  });

  it('should keep timeout on error', async () => {
    fakeCallback.mockImplementationOnce(() => {
      throw new Error();
    });
    render(<Dummy />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(fakeCallback).toHaveBeenCalledTimes(4);
  });

  it('should stop timeout flow', async () => {
    render(<Dummy />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    await Promise.resolve();

    fireEvent.click(screen.getAllByRole('button')[1]);

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(fakeCallback).toHaveBeenCalledTimes(1);
  });

  it('should change interval', async () => {
    render(<Dummy />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    await Promise.resolve();
    expect(fakeCallback).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button')[2]);

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(fakeCallback).toHaveBeenCalledTimes(2);
  });
});
