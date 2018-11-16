import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceSettings, Props } from './DataSourceSettings';
import { DataSource, NavModel } from '../../../types';
import { getMockDataSource } from '../__mocks__/dataSourcesMocks';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    dataSource: getMockDataSource(),
    dataSourceMeta: getMockPlugin(),
    pageId: 1,
    deleteDataSource: jest.fn(),
    loadDataSource: jest.fn(),
    setDataSourceName: jest.fn(),
    updateDataSource: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<DataSourceSettings {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render loader', () => {
    const wrapper = setup({
      dataSource: {} as DataSource,
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render beta info text', () => {
    const wrapper = setup({
      dataSourceMeta: { ...getMockPlugin(), state: 'beta' },
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render alpha info text', () => {
    const wrapper = setup({
      dataSourceMeta: { ...getMockPlugin(), state: 'alpha' },
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render is ready only message', () => {
    const wrapper = setup({
      dataSource: { ...getMockDataSource(), readOnly: true },
    });

    expect(wrapper).toMatchSnapshot();
  });
});
