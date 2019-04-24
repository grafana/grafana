import React from 'react';
import { shallow } from 'enzyme';
import DataSourcesList from './DataSourcesList';
import { getMockDataSources } from './__mocks__/dataSourcesMocks';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

const setup = () => {
  const props = {
    dataSources: getMockDataSources(3),
    layoutMode: LayoutModes.Grid,
  };

  return shallow(<DataSourcesList {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
