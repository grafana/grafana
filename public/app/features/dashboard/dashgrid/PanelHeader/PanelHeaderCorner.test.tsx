import React from 'react';
import { shallow } from 'enzyme';
import { PanelHeaderCorner } from './PanelHeaderCorner';
import { PanelModel } from '../../state';

describe('Render', () => {
  it('should render component', () => {
    const panel = new PanelModel({});
    const wrapper = shallow(<PanelHeaderCorner panel={panel} />);
    const instance = wrapper.instance() as PanelHeaderCorner;

    expect(instance.getInfoContent()).toBeDefined();
  });
});
