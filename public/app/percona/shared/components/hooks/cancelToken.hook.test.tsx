import React from 'react';
import { useCancelToken } from './cancelToken.hook';
import axios from 'axios';
import { render, screen, fireEvent } from '@testing-library/react';

const FIRST_CANCEL_TOKEN = 'firstRequest';
const SECOND_CANCEL_TOKEN = 'secondRequest';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    CancelToken: {
      source: jest.fn(),
    },
  },
}));
const cancelSpy = jest.fn();
const sourceSpy = jest.fn().mockImplementation(() => ({ cancel: cancelSpy }));

jest.spyOn(axios.CancelToken, 'source').mockImplementation(sourceSpy);

const Dummy = () => {
  const [generateToken, cancelToken] = useCancelToken();

  return (
    <>
      <button onClick={() => generateToken(FIRST_CANCEL_TOKEN)} />
      <button onClick={() => generateToken(SECOND_CANCEL_TOKEN)} />
      <button onClick={() => cancelToken(FIRST_CANCEL_TOKEN)} />
    </>
  );
};

describe('useCancelToken', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should cancel previous identical requests', () => {
    render(<Dummy />);
    const buttons = screen.getAllByRole('button');

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);

    expect(sourceSpy).toHaveBeenCalledTimes(3);
    expect(cancelSpy).toHaveBeenCalledTimes(2);
  });

  it('should keep different requests', async () => {
    render(<Dummy />);
    const buttons = screen.getAllByRole('button');

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);

    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[1]);

    expect(sourceSpy).toHaveBeenCalledTimes(5);
    expect(cancelSpy).toHaveBeenCalledTimes(4);
  });

  it('should clean all requests on unmount', () => {
    const { unmount } = render(<Dummy />);
    const buttons = screen.getAllByRole('button');

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);

    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[1]);

    unmount();
    expect(cancelSpy).toHaveBeenCalledTimes(7);
  });

  it('should explicitly cancel a token', () => {
    render(<Dummy />);
    const buttons = screen.getAllByRole('button');

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
