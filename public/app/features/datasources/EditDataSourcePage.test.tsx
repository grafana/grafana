import React from 'react';
import { shallow } from 'enzyme';
import { EditDataSourcePage, Props } from './EditDataSourcePage';
import { DataSource, NavModel } from '../../types';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    dataSource: {} as DataSource,
    dataSourceId: 1,
    pageName: '',
    loadDataSource: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<EditDataSourcePage {...props} />);
  const instance = wrapper.instance() as EditDataSourcePage;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render permissions page', () => {
    const { wrapper } = setup({
      pageName: 'permissions',
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Functions', () => {
  describe('is page valid', () => {
    it('should be a valid page', () => {
      const { instance } = setup();

      expect(instance.isValidPage('permissions')).toBeTruthy();
    });

    it('should not be a valid page', () => {
      const { instance } = setup();

      expect(instance.isValidPage('asdf')).toBeFalsy();
    });
  });

  describe('get current page', () => {
    it('should return permissions', () => {
      const { instance } = setup({
        pageName: 'permissions',
      });

      expect(instance.getCurrentPage()).toEqual('permissions');
    });

    it('should return settings if bogus route', () => {
      const { instance } = setup({
        pageName: 'asdf',
      });

      expect(instance.getCurrentPage()).toEqual('settings');
    });
  });
});
