import React from 'react';
import { shallow } from 'enzyme';
import DataSourcesListItem from './DataSourcesListItem';
import { getMockDataSource } from './__mocks__/dataSourcesMocks';

const setup = () => {
  const props = {
    dataSource: getMockDataSource(),
  };

  return shallow(<DataSourcesListItem {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
