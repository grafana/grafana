import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { useSelector } from 'react-redux';
import { dataQa } from '@percona/platform-core';
import { act } from 'react-dom/test-utils';
import { Breadcrumb } from './Breadcrumb';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

const pageModel = {
  title: 'Root',
  path: 'root',
  id: 'root',
};

describe('Breadcrumb', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ location: { path: '/root/child-one' } });
    });
  });
  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('renders the breadcrumb', async () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<Breadcrumb pageModel={pageModel} />);
    });

    expect(wrapper.find(dataQa('breadcrumb'))).toHaveLength(1);
  });
});
