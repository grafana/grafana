import React from 'react';
import { shallow } from 'enzyme';
import { DataSourcesActionBar, Props } from './DataSourcesActionBar';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

const setup = (propOverrides?: object) => {
  const props: Props = {
    layoutMode: LayoutModes.Grid,
    searchQuery: '',
    setDataSourcesLayoutMode: jest.fn(),
    setDataSourcesSearchQuery: jest.fn(),
  };

  return shallow(<DataSourcesActionBar {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
