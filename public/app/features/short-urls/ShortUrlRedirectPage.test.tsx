import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { NavModel } from '@grafana/data';
import { mockShortUrlLookup, mockUid } from './mocks';
import ShortUrlRedirectPage from './ShortUrlRedirectPage';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const setup = async (): Promise<any> => {
  const props: any = {
    navModel: {} as NavModel,
    shortLinkUid: mockUid,
  };
  let wrapper;
  //@ts-ignore
  await act(async () => {
    wrapper = await mount(<ShortUrlRedirectPage {...props} />);
    jest.runAllTimers();
  });
  return wrapper;
};

describe('ShortUrlRedirect', () => {
  it('should call goto api and redirect when initialized with valid uid', async () => {
    await setup();

    expect(mockShortUrlLookup).toHaveBeenCalledTimes(1);
    expect(mockShortUrlLookup).toHaveBeenCalledWith({
      uid: mockUid,
    });
  });
});
