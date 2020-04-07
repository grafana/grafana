import React from 'react';
import { shallow, render } from 'enzyme';
import { TableContainer } from './TableContainer';
import { DataFrame } from '@grafana/data';
import { toggleTable } from './state/actions';
import { ExploreId } from 'app/types/explore';

describe('TableContainer', () => {
  it('should render component', () => {
    const props = {
      exploreId: ExploreId.left as ExploreId,
      loading: false,
      width: 800,
      onClickCell: jest.fn(),
      showingTable: true,
      tableResult: {} as DataFrame,
      toggleTable: {} as typeof toggleTable,
    };

    const wrapper = shallow(<TableContainer {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should render 0 series returned on no items', () => {
    const props = {
      exploreId: ExploreId.left as ExploreId,
      loading: false,
      width: 800,
      onClickCell: jest.fn(),
      showingTable: true,
      tableResult: {
        name: 'TableResultName',
        fields: [],
        length: 0,
      } as DataFrame,
      toggleTable: {} as typeof toggleTable,
    };

    const wrapper = render(<TableContainer {...props} />);
    expect(wrapper.find('0 series returned')).toBeTruthy();
  });
});
