import React from 'react';
import { useSelector } from 'react-redux';
import { dataQa } from '@percona/platform-core';
import { Breadcrumb } from './Breadcrumb';
import { getMount } from 'app/percona/shared/helpers/testUtils';

jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

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
    const wrapper = await getMount(<Breadcrumb pageModel={pageModel} currentLocation="root/child-one" />);

    expect(wrapper.find(dataQa('breadcrumb'))).toHaveLength(1);
  });
});
