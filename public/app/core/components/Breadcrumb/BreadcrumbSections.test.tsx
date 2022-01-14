import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { useSelector } from 'react-redux';
import { dataQa } from '@percona/platform-core';
import { act } from 'react-dom/test-utils';
import { BreadcrumbSections } from './BreadcrumbSections';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

const pageModel = {
  title: 'Root',
  path: 'root',
  id: 'root',
  children: [
    {
      title: 'Child 1',
      id: 'child-1',
      path: 'root/child-one',
    },
    {
      title: 'Child 2',
      id: 'child-2',
      path: 'root/child-two',
      children: [
        {
          title: 'Leaf 1',
          id: 'leaf-1',
          path: 'root/child-two/leaf-one',
        },
        {
          title: 'Leaf 2',
          id: 'leaf-2',
          path: 'root/wrong-one/leaf-two',
        },
      ],
    },
    {
      title: 'Child 3',
      id: 'child-3',
      path: 'root/child-three',
    },
  ],
};

describe('BreadcrumbSections', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ location: { path: '/root/child-one' } });
    });
  });
  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('renders breadcrumb sections with correct URLs', async () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<BreadcrumbSections pageModel={pageModel} currentLocation="root/child-one" />);
    });

    expect(wrapper.find(dataQa('breadcrumb-section'))).toHaveLength(2);
    expect(wrapper.find(dataQa('breadcrumb-section')).at(0).text()).toEqual('Root / Child 1');
  });

  it('renders breadcrumb sections with noncorrect URLs', async () => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ location: { path: '/root/child-two/leaf-one' } });
    });

    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<BreadcrumbSections pageModel={pageModel} currentLocation="root/child-two/leaf-one" />);
    });

    expect(wrapper.find(dataQa('breadcrumb-section'))).toHaveLength(3);
    expect(wrapper.find(dataQa('breadcrumb-section')).at(0).text()).toEqual('Root / Child 2 / Leaf 1');
  });

  it('renders breadcrumb sections even with a broken pageModel', async () => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ location: { path: '/root/wrong-one/leaf-two' } });
    });

    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;

    await act(async () => {
      wrapper = mount(<BreadcrumbSections pageModel={pageModel} currentLocation="root/wrong-one/leaf-two" />);
    });

    expect(wrapper.find(dataQa('breadcrumb-section'))).toHaveLength(1);
    expect(wrapper.find(dataQa('breadcrumb-section')).at(0).text()).toEqual('Root');
  });
});
