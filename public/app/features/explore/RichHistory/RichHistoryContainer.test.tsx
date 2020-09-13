import React from 'react';
import { mount } from 'enzyme';
import { Resizable } from 're-resizable';

import { ExploreId } from '../../../types/explore';
import { RichHistoryContainer, Props } from './RichHistoryContainer';
import { Tabs } from './RichHistory';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    width: 500,
    exploreId: ExploreId.left,
    activeDatasourceInstance: 'Test datasource',
    richHistory: [],
    firstTab: Tabs.RichHistory,
    deleteRichHistory: jest.fn(),
    onClose: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<RichHistoryContainer {...props} />);
  return wrapper;
};

describe('RichHistoryContainer', () => {
  it('should render reseizable component', () => {
    const wrapper = setup();
    expect(wrapper.find(Resizable)).toHaveLength(1);
  });
  it('should render component with correct width', () => {
    const wrapper = setup();
    expect(wrapper.getDOMNode().getAttribute('style')).toContain('width: 531.5px');
  });
  it('should render component with correct height', () => {
    const wrapper = setup();
    expect(wrapper.getDOMNode().getAttribute('style')).toContain('height: 400px');
  });
});
