import React from 'react';
import { mount } from 'enzyme';
import { ExploreDrawer } from './ExploreDrawer';

describe('<ExploreDrawer />', () => {
  it('renders child element', () => {
    const childElement = <div>Child element</div>;
    const wrapper = mount(<ExploreDrawer width={400}>{childElement}</ExploreDrawer>);
    expect(wrapper.text()).toBe('Child element');
  });
});
