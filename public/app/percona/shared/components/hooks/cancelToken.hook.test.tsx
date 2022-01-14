import React from 'react';
import { mount } from 'enzyme';
import { useCancelToken } from './cancelToken.hook';
import axios from 'axios';

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
      <button onClick={() => generateToken(FIRST_CANCEL_TOKEN)}></button>
      <button onClick={() => generateToken(SECOND_CANCEL_TOKEN)}></button>
      <button onClick={() => cancelToken(FIRST_CANCEL_TOKEN)}></button>
    </>
  );
};

describe('useCancelToken', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should cancel previous identical requests', () => {
    const wrapper = mount(<Dummy />);
    const button = wrapper.find('button');

    button.first().simulate('click');
    button.first().simulate('click');
    button.first().simulate('click');

    expect(sourceSpy).toHaveBeenCalledTimes(3);
    expect(cancelSpy).toHaveBeenCalledTimes(2);
  });

  it('should keep different requests', () => {
    const wrapper = mount(<Dummy />);
    const button = wrapper.find('button');

    button.first().simulate('click');
    button.first().simulate('click');
    button.first().simulate('click');

    button.at(1).simulate('click');
    button.at(1).simulate('click');

    expect(sourceSpy).toHaveBeenCalledTimes(5);
    expect(cancelSpy).toHaveBeenCalledTimes(3);
  });

  it('should clean all requests on unmount', () => {
    const wrapper = mount(<Dummy />);
    const button = wrapper.find('button');

    button.first().simulate('click');
    button.first().simulate('click');
    button.first().simulate('click');

    button.at(1).simulate('click');
    button.at(1).simulate('click');

    wrapper.unmount();

    expect(cancelSpy).toHaveBeenCalledTimes(5);
  });

  it('should explicitly cancel a token', () => {
    const wrapper = mount(<Dummy />);
    const button = wrapper.find('button');

    button.first().simulate('click');
    button.last().simulate('click');

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
