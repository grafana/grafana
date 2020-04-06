import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { mockSearch } from './mocks';
import { DashboardSearch } from './DashboardSearch';

beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Need to wrap component render in async act and use jest.runAllTimers to test
 * calls inside useDebounce hook
 */
describe('DashboardSearch', () => {
  it('should call search api with default query when initialised', async () => {
    await act(async () => {
      const wrapper = mount(<DashboardSearch closeSearch={() => {}} />);
      jest.runAllTimers();
      wrapper.update();
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith({
      query: '',
      parsedQuery: { text: '' },
      tags: [],
      tag: [],
      starred: false,
    });
  });

  it('should call api with updated query on query change', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = mount(<DashboardSearch closeSearch={() => {}} />);
      jest.runAllTimers();
      wrapper.update();
    });

    await act(async () => {
      wrapper.find({ placeholder: 'Search dashboards by name' }).prop('onChange')({ currentTarget: { value: 'Test' } });
      jest.runAllTimers();
      wrapper.update();
    });

    expect(mockSearch).toHaveBeenCalledWith({
      query: 'Test',
      parsedQuery: { text: 'Test' },
      tags: [],
      tag: [],
      starred: false,
    });
  });
});
