import React from 'react';
import { render, shallow } from 'enzyme';
import { TableContainer } from './TableContainer';
import { DataFrame } from '@grafana/data';
import { ExploreId } from 'app/types/explore';

describe('TableContainer', () => {
  it('should render component', () => {
    const props = {
      exploreId: ExploreId.left as ExploreId,
      loading: false,
      width: 800,
      onCellFilterAdded: jest.fn(),
      tableResult: {} as DataFrame,
      splitOpen: (() => {}) as any,
      range: {} as any,
    };

    const wrapper = shallow(<TableContainer {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should render 0 series returned on no items', () => {
    const props = {
      exploreId: ExploreId.left as ExploreId,
      loading: false,
      width: 800,
      onCellFilterAdded: jest.fn(),
      tableResult: {
        name: 'TableResultName',
        fields: [],
        length: 0,
      } as DataFrame,
      splitOpen: (() => {}) as any,
      range: {} as any,
    };

    const wrapper = render(<TableContainer {...props} />);
    expect(wrapper.find('0 series returned')).toBeTruthy();
  });
});
